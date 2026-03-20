// POST /api/admin/personal-brand/image
//
// Image generation with automatic fallback chain:
//   1. Hugging Face (FLUX.1-schnell) — primary, free tier, best quality
//   2. Pollinations.ai               — fallback, no key needed, always available
//
// Required env var: HUGGINGFACE_API_KEY (huggingface.co → Settings → Access Tokens)
// No other keys needed — Pollinations requires nothing.
//
// Body:   { postContent?, style, platform, customPrompt? }
// Returns: { imageUrl, storedUrl, prompt, provider }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ── Lazy-initialised clients — never crash at module load ─────────────────
function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
function getClaude() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// ── Dimensions ────────────────────────────────────────────────────────────
const DIMENSIONS: Record<string, { width: number; height: number }> = {
  linkedin: { width: 1200, height: 627  },
  twitter:  { width: 1200, height: 675  },
  square:   { width: 1080, height: 1080 },
};

// ── Ascentor brand palette injected into every style ─────────────────────
// Dark: #0C0B08  Gold: #E8A020  Parchment: #F5F3EE / #FAF7F2
// Cream: #F2EDE4  Mid-tone: #4A4438  Border: #DDD5C8
const STYLE_CONTEXT: Record<string, string> = {
  dark_gold:      'Near-black background #0C0B08, warm gold #E8A020 dominant accent, cinematic lighting, editorial quality, sophisticated, no text',
  light_warm:     'Warm parchment background #F5F3EE, rich gold #E8A020 accents, soft cream #F2EDE4 tones, airy and professional, editorial quality, no text',
  dark_contrast:  'Deep near-black #0C0B08 background, bold warm gold #E8A020 geometric shapes, cream #F2EDE4 highlights, high contrast, cinematic, no text',
  light_editorial:'Cream #F2EDE4 and parchment #F5F3EE tones, warm mid-tone shadows #4A4438, gold #E8A020 focal element, clean editorial magazine style, no text',
  gradient_brand: 'Gradient from warm parchment #FAF7F2 to near-black #0C0B08, gold #E8A020 accent line or glow, sophisticated luxury transition, no text',
  terminal:       'Dark near-black #0C0B08 background, warm gold #E8A020 monospace glow effect, subtle amber scanlines, cybersecurity aesthetic with brand warmth, no text',
  abstract_gold:  'Abstract geometric network nodes and flowing lines, alternating near-black #0C0B08 and warm parchment #F5F3EE zones, gold #E8A020 connectors, sophisticated, no text',
};

// ── Claude prompt refiner ─────────────────────────────────────────────────
async function refinePrompt(
  postContent: string,
  style: string,
  platform: string
): Promise<string> {
  const msg = await getClaude().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are a creative director for a professional cybersecurity practitioner's personal brand.

Write a concise image generation prompt (max 60 words) based on this ${platform} post:
- Visually complement the post theme without illustrating it literally
- Apply this style: ${STYLE_CONTEXT[style] || style}
- Absolutely no text, words, logos, or letters anywhere in the image
- Photorealistic or high-quality digital art — never cartoonish or illustrative
- Professional, premium feel

POST CONTENT:
${postContent.slice(0, 400)}

Return ONLY the image prompt. Nothing else.`,
    }],
  });
  return (msg.content[0] as any).text?.trim()
    || `Professional cybersecurity abstract, ${STYLE_CONTEXT[style]}, editorial quality, no text`;
}

// ── Provider 1: Hugging Face (FLUX.1-schnell) ─────────────────────────────
async function generateWithHuggingFace(
  prompt: string,
  dims: { width: number; height: number }
): Promise<ArrayBuffer> {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) throw new Error('HUGGINGFACE_API_KEY not set');

  // HF inference API — FLUX.1-schnell (same model as fal.ai, completely free tier)
  const res = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
        'X-Wait-For-Model': 'true', // wait instead of returning 503 if model is loading
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width:               dims.width,
          height:              dims.height,
          num_inference_steps: 4,
          guidance_scale:      0,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    // 429 = rate limited / quota hit — caller will fall back to Pollinations
    const err = new Error(`HF error ${res.status}: ${errText}`);
    (err as any).status = res.status;
    throw err;
  }

  // HF returns raw image bytes directly
  return res.arrayBuffer();
}

// ── Provider 2: Pollinations.ai (fallback — zero config) ─────────────────
async function generateWithPollinations(
  prompt: string,
  dims: { width: number; height: number }
): Promise<ArrayBuffer> {
  // Pollinations is a free public API — no key, no signup, just a URL
  // Model: FLUX (same underlying model as HF)
  const encoded = encodeURIComponent(prompt);
  const seed    = Math.floor(Math.random() * 999999);
  const url     = `https://image.pollinations.ai/prompt/${encoded}?width=${dims.width}&height=${dims.height}&seed=${seed}&model=flux&nologo=true&enhance=false`;

  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Pollinations error ${res.status}`);
  return res.arrayBuffer();
}

// ── Persist image to Supabase storage ────────────────────────────────────
async function persistToSupabase(
  buffer: ArrayBuffer,
  platform: string,
  provider: string
): Promise<string | null> {
  try {
    const service  = getService();
    const filename = `personal-brand/${Date.now()}-${platform}-${provider}.png`;
    const { error } = await service.storage
      .from('content-media')
      .upload(filename, buffer, { contentType: 'image/png', upsert: false });
    if (error) return null;
    const { data: { publicUrl } } = service.storage
      .from('content-media')
      .getPublicUrl(filename);
    return publicUrl;
  } catch {
    return null;
  }
}

// ── Convert ArrayBuffer to base64 data URL (for immediate display) ────────
function toDataUrl(buffer: ArrayBuffer): string {
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:image/png;base64,' + btoa(binary);
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── Startup diagnostic — returns clear JSON errors instead of crashing ──
  const missingVars: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)   missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.ANTHROPIC_API_KEY)           missingVars.push('ANTHROPIC_API_KEY');
  if (missingVars.length > 0) {
    return NextResponse.json(
      { error: `Missing env vars: ${missingVars.join(', ')}` },
      { status: 500 }
    );
  }

  // Auth
  const service    = getService();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await service
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const {
    postContent  = '',
    style        = 'dark_gold',
    platform     = 'linkedin',
    customPrompt = '',
  } = await req.json();

  const dims = DIMENSIONS[platform] || DIMENSIONS.linkedin;

  try {
    // Build the image prompt
    const imagePrompt = customPrompt.trim()
      ? `${customPrompt.trim()}, ${STYLE_CONTEXT[style] || ''}, no text, no words`
      : postContent.trim()
      ? await refinePrompt(postContent, style, platform)
      : `Professional cybersecurity abstract concept, ${STYLE_CONTEXT[style]}, editorial quality, no text`;

    // ── Try Hugging Face first ──────────────────────────────────────────
    let imageBuffer: ArrayBuffer | null = null;
    let provider = 'huggingface';

    try {
      console.log('[personal-brand/image] Trying Hugging Face…');
      imageBuffer = await generateWithHuggingFace(imagePrompt, dims);
      console.log('[personal-brand/image] Hugging Face OK');
    } catch (hfErr: any) {
      // 429 = quota hit, 503 = model loading timeout — fall back gracefully
      // Any other error also falls back rather than hard-failing
      console.warn(`[personal-brand/image] HF failed (${hfErr.message}), falling back to Pollinations`);
      provider    = 'pollinations';
      imageBuffer = null;
    }

    // ── Fall back to Pollinations ───────────────────────────────────────
    if (!imageBuffer) {
      try {
        console.log('[personal-brand/image] Trying Pollinations…');
        imageBuffer = await generateWithPollinations(imagePrompt, dims);
        console.log('[personal-brand/image] Pollinations OK');
      } catch (polErr: any) {
        console.error('[personal-brand/image] Pollinations also failed:', polErr.message);
        return NextResponse.json(
          { error: 'Both image providers failed. Try again in a moment.' },
          { status: 500 }
        );
      }
    }

    // ── Persist to Supabase ─────────────────────────────────────────────
    const storedUrl = await persistToSupabase(imageBuffer, platform, provider);

    // If Supabase storage fails, return a base64 data URL so the UI still shows the image
    const imageUrl = storedUrl || toDataUrl(imageBuffer);

    return NextResponse.json({
      imageUrl:  storedUrl || imageUrl,
      storedUrl: storedUrl || null,
      prompt:    imagePrompt,
      provider,  // 'huggingface' or 'pollinations' — shown in UI for transparency
      platform,
      style,
    });

  } catch (err: any) {
    console.error('[personal-brand/image] Unhandled error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
