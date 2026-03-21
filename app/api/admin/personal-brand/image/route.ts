// POST /api/admin/personal-brand/image
//
// Image generation — 3-provider fallback chain:
//   1. Hugging Face FLUX.1-schnell  — best quality, free tier
//   2. Pollinations FLUX (reduced)  — no key, fast at smaller size
//   3. Pollinations turbo            — fastest fallback, always works
//
// maxDuration = 90s — required for Vercel (image gen takes 20-60s)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import Anthropic from '@anthropic-ai/sdk';

// Required for Vercel — image generation takes 20-60s
export const maxDuration = 90;

// Lazy clients — never crash at module load
function getService() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Dimensions ────────────────────────────────────────────────────────────
// Note: we use slightly reduced sizes to keep generation times under 30s
const DIMENSIONS: Record<string, { width: number; height: number; reduced: { width: number; height: number } }> = {
  linkedin: { width: 1200, height: 627,  reduced: { width: 896, height: 512 } },
  twitter:  { width: 1200, height: 675,  reduced: { width: 896, height: 512 } },
  square:   { width: 1080, height: 1080, reduced: { width: 768, height: 768 } },
};

// ── Ascentor brand palette ────────────────────────────────────────────────
const STYLE_CONTEXT: Record<string, string> = {
  dark_gold:      'Near-black background #0C0B08, warm gold #E8A020 dominant accent, cinematic lighting, editorial quality, sophisticated, no text',
  light_warm:     'Warm parchment background #F5F3EE, rich gold #E8A020 accents, soft cream #F2EDE4 tones, airy and professional, editorial quality, no text',
  dark_contrast:  'Deep near-black #0C0B08 background, bold warm gold #E8A020 geometric shapes, cream #F2EDE4 highlights, high contrast, cinematic, no text',
  light_editorial:'Cream #F2EDE4 and parchment #F5F3EE tones, warm mid-tone shadows #4A4438, gold #E8A020 focal element, clean editorial magazine style, no text',
  gradient_brand: 'Gradient from warm parchment #FAF7F2 to near-black #0C0B08, gold #E8A020 accent line or glow, sophisticated luxury transition, no text',
  terminal:       'Dark near-black #0C0B08 background, warm gold #E8A020 monospace glow effect, subtle amber scanlines, cybersecurity aesthetic, no text',
  abstract_gold:  'Abstract geometric network nodes, alternating near-black #0C0B08 and warm parchment #F5F3EE zones, gold #E8A020 connectors, sophisticated, no text',
};

// ── Claude prompt refiner ─────────────────────────────────────────────────
async function refinePrompt(postContent: string, style: string, platform: string): Promise<string> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await claude.messages.create({
    model:      'claude-haiku-4-5-20251001', // faster + cheaper for prompt refinement
    max_tokens: 150,
    messages: [{
      role:    'user',
      content: `Write a concise image generation prompt (max 50 words) for a ${platform} post by a cybersecurity professional.
Style: ${STYLE_CONTEXT[style] || style}
No text, words, or letters in the image. Photorealistic or digital art. Professional and premium.

POST (first 300 chars): ${postContent.slice(0, 300)}

Return ONLY the prompt.`,
    }],
  });
  return (msg.content[0] as any).text?.trim()
    || `Professional cybersecurity abstract, ${STYLE_CONTEXT[style]}, no text`;
}

// ── Provider 1: Hugging Face FLUX.1-schnell ───────────────────────────────
async function tryHuggingFace(prompt: string, dims: { width: number; height: number }): Promise<ArrayBuffer> {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) throw new Error('HUGGINGFACE_API_KEY not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000); // 45s timeout

  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method:  'POST',
        headers: {
          'Authorization':  `Bearer ${hfKey}`,
          'Content-Type':   'application/json',
          'X-Wait-For-Model': 'true',
        },
        body: JSON.stringify({
          inputs:     prompt,
          parameters: {
            width:               dims.width,
            height:              dims.height,
            num_inference_steps: 4,
            guidance_scale:      0,
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`HF ${res.status}: ${err.slice(0, 200)}`);
    }

    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      // HF returned JSON error instead of image bytes
      const errJson = await res.json().catch(() => ({}));
      throw new Error(`HF returned non-image: ${errJson?.error || ct}`);
    }

    return res.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Provider 2: Pollinations FLUX (reduced dimensions) ───────────────────
async function tryPollinations(prompt: string, dims: { width: number; height: number }, model = 'flux'): Promise<ArrayBuffer> {
  const encoded = encodeURIComponent(prompt);
  const seed    = Math.floor(Math.random() * 999999);
  const url     = `https://image.pollinations.ai/prompt/${encoded}?width=${dims.width}&height=${dims.height}&seed=${seed}&model=${model}&nologo=true&enhance=false`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000); // 55s timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Pollinations ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error(`Pollinations non-image response: ${ct}`);
    return res.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Persist to Supabase ───────────────────────────────────────────────────
async function persist(buffer: ArrayBuffer, platform: string, provider: string): Promise<string | null> {
  try {
    const service  = getService();
    const filename = `personal-brand/${Date.now()}-${platform}-${provider}.png`;
    const { error } = await service.storage
      .from('content-media')
      .upload(filename, buffer, { contentType: 'image/png', upsert: false });
    if (error) return null;
    return service.storage.from('content-media').getPublicUrl(filename).data.publicUrl;
  } catch {
    return null;
  }
}

// ── base64 fallback if Supabase upload fails ──────────────────────────────
function toDataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary  = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:image/png;base64,' + btoa(binary);
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Startup diagnostic
  const missing = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ANTHROPIC_API_KEY']
    .filter(k => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing env vars: ${missing.join(', ')}` }, { status: 500 });
  }

  // Auth
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getService();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { postContent = '', style = 'dark_gold', platform = 'linkedin', customPrompt = '' } = await req.json();

  const dims = DIMENSIONS[platform] || DIMENSIONS.linkedin;

  try {
    // Build prompt
    const imagePrompt = customPrompt.trim()
      ? `${customPrompt.trim()}, ${STYLE_CONTEXT[style] || ''}, no text`
      : postContent.trim()
      ? await refinePrompt(postContent, style, platform)
      : `Professional cybersecurity abstract, ${STYLE_CONTEXT[style]}, editorial quality, no text`;

    const errors: string[] = [];
    let imageBuffer: ArrayBuffer | null = null;
    let provider = '';

    // ── 1. Hugging Face ───────────────────────────────────────────────────
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        console.log('[pb/image] Trying HuggingFace…');
        imageBuffer = await tryHuggingFace(imagePrompt, dims.reduced);
        provider    = 'huggingface';
        console.log('[pb/image] HuggingFace OK');
      } catch (e: any) {
        console.warn('[pb/image] HF failed:', e.message);
        errors.push(`HuggingFace: ${e.message}`);
      }
    } else {
      errors.push('HuggingFace: API key not set');
    }

    // ── 2. Pollinations FLUX (reduced size) ───────────────────────────────
    if (!imageBuffer) {
      try {
        console.log('[pb/image] Trying Pollinations flux…');
        imageBuffer = await tryPollinations(imagePrompt, dims.reduced, 'flux');
        provider    = 'pollinations';
        console.log('[pb/image] Pollinations flux OK');
      } catch (e: any) {
        console.warn('[pb/image] Pollinations flux failed:', e.message);
        errors.push(`Pollinations flux: ${e.message}`);
      }
    }

    // ── 3. Pollinations turbo (fastest, smallest) ─────────────────────────
    if (!imageBuffer) {
      try {
        console.log('[pb/image] Trying Pollinations turbo…');
        const smallDims = { width: 512, height: 512 };
        imageBuffer = await tryPollinations(imagePrompt, smallDims, 'turbo');
        provider    = 'pollinations-turbo';
        console.log('[pb/image] Pollinations turbo OK');
      } catch (e: any) {
        console.warn('[pb/image] Pollinations turbo failed:', e.message);
        errors.push(`Pollinations turbo: ${e.message}`);
      }
    }

    if (!imageBuffer) {
      return NextResponse.json({
        error: `All providers failed. Details: ${errors.join(' | ')}`,
      }, { status: 500 });
    }

    // Persist to Supabase
    const storedUrl = await persist(imageBuffer, platform, provider);
    const imageUrl  = storedUrl || toDataUrl(imageBuffer);

    return NextResponse.json({ imageUrl, storedUrl, prompt: imagePrompt, provider, platform, style });

  } catch (err: any) {
    console.error('[pb/image] Unhandled:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
