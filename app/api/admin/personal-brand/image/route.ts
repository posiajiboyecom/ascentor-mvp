// POST /api/admin/personal-brand/image
//
// Image generation — provider chain:
//   1. Pollinations.ai (sdxl)       — free, no key, stable
//   2. Pollinations.ai (flux)       — free, no key, fallback
//   3. Hugging Face FLUX.1-schnell  — requires PERSONAL HF token (not org token)
//
// NOTE on HuggingFace:
//   If you see "does not have sufficient permissions to call Inference Providers"
//   it means you are using an org token. Go to:
//   huggingface.co → YOUR PERSONAL profile (not the org) → Settings → Access Tokens
//   Create a token under YOUR personal account, not under ascentor-mvp.
//
// maxDuration = 90s — required for Vercel (image gen takes 20-60s)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 90;

function getService() {
  const { createClient: sc } = require('@supabase/supabase-js');
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Dimensions ────────────────────────────────────────────────────────────
const DIMENSIONS: Record<string, { width: number; height: number }> = {
  linkedin: { width: 896, height: 512 },
  twitter:  { width: 896, height: 512 },
  square:   { width: 768, height: 768 },
};

// ── Ascentor brand palette ────────────────────────────────────────────────
const STYLE_CONTEXT: Record<string, string> = {
  dark_gold:      'near-black background, warm gold accent, cinematic lighting, editorial quality, no text',
  light_warm:     'warm parchment background, gold accents, soft cream tones, airy professional, no text',
  dark_contrast:  'deep black background, bold gold geometric shapes, cream highlights, high contrast, no text',
  light_editorial:'cream and parchment tones, warm shadows, gold focal element, editorial magazine style, no text',
  gradient_brand: 'gradient from warm cream to near-black, gold accent line, sophisticated luxury, no text',
  terminal:       'dark background, gold monospace glow effect, amber scanlines, cybersecurity aesthetic, no text',
  abstract_gold:  'abstract geometric network nodes, black and cream zones, gold connectors, sophisticated, no text',
};

// ── Claude prompt refiner ─────────────────────────────────────────────────
async function refinePrompt(postContent: string, style: string): Promise<string> {
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const msg = await claude.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role:    'user',
        content: `Write a 40-word image generation prompt for a cybersecurity professional's social post.
Style: ${STYLE_CONTEXT[style] || style}
No text or words in the image. Photorealistic or digital art. Professional.
Post (first 200 chars): ${postContent.slice(0, 200)}
Return ONLY the prompt.`,
      }],
    });
    return (msg.content[0] as any).text?.trim()
      || `Professional cybersecurity concept, ${STYLE_CONTEXT[style]}, no text`;
  } catch {
    // If Claude fails, use a good default based on style
    return `Professional cybersecurity digital art, ${STYLE_CONTEXT[style]}, dramatic lighting, no text`;
  }
}

// ── Pollinations fetch with timeout ──────────────────────────────────────
async function fetchPollinations(
  prompt: string,
  width: number,
  height: number,
  model: string,
  timeoutMs: number
): Promise<ArrayBuffer> {
  const encoded = encodeURIComponent(prompt);
  const seed    = Math.floor(Math.random() * 99999);
  const url     = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      const body = await res.text().catch(() => '');
      throw new Error(`non-image response: ${ct} — ${body.slice(0, 100)}`);
    }
    return res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

// ── HuggingFace (personal token required) ────────────────────────────────
async function fetchHuggingFace(
  prompt: string,
  width: number,
  height: number
): Promise<ArrayBuffer> {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) throw new Error('HUGGINGFACE_API_KEY not set');

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 50_000);

  try {
    const res = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method:  'POST',
        headers: {
          'Authorization':    `Bearer ${hfKey}`,
          'Content-Type':     'application/json',
          'X-Wait-For-Model': 'true',
        },
        body: JSON.stringify({
          inputs:     prompt,
          parameters: { width, height, num_inference_steps: 4, guidance_scale: 0 },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`HF ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      const body = await res.text().catch(() => '');
      throw new Error(`HF non-image: ${body.slice(0, 200)}`);
    }
    return res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

// ── Persist to Supabase storage ───────────────────────────────────────────
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

function toDataUrl(buffer: ArrayBuffer): string {
  const bytes  = new Uint8Array(buffer);
  let   binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:image/png;base64,' + btoa(binary);
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']
    .filter(k => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing env vars: ${missing.join(', ')}` }, { status: 500 });
  }

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getService();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const {
    postContent  = '',
    style        = 'dark_gold',
    platform     = 'linkedin',
    customPrompt = '',
  } = await req.json();

  const dims = DIMENSIONS[platform] || DIMENSIONS.linkedin;

  // Build prompt
  const imagePrompt = customPrompt.trim()
    ? `${customPrompt.trim()}, ${STYLE_CONTEXT[style] || ''}, no text`
    : postContent.trim()
    ? await refinePrompt(postContent, style)
    : `Professional cybersecurity digital art, ${STYLE_CONTEXT[style]}, no text`;

  const errors: string[] = [];
  let imageBuffer: ArrayBuffer | null = null;
  let provider = '';

  // ── 1. Pollinations sdxl — most stable free model ─────────────────────
  try {
    console.log('[pb/image] Trying Pollinations sdxl…');
    imageBuffer = await fetchPollinations(imagePrompt, dims.width, dims.height, 'flux', 75_000);
    provider    = 'pollinations-flux';
    console.log('[pb/image] Pollinations flux OK');
  } catch (e: any) {
    console.warn('[pb/image] Pollinations flux failed:', e.message);
    errors.push(`Pollinations flux: ${e.message}`);
  }

  // ── 2. Pollinations 512×512 — smaller, faster ─────────────────────────
  if (!imageBuffer) {
    try {
      console.log('[pb/image] Trying Pollinations 512…');
      imageBuffer = await fetchPollinations(imagePrompt, 512, 512, 'flux', 75_000);
      provider    = 'pollinations-512';
      console.log('[pb/image] Pollinations 512 OK');
    } catch (e: any) {
      console.warn('[pb/image] Pollinations 512 failed:', e.message);
      errors.push(`Pollinations 512: ${e.message}`);
    }
  }

  // ── 3. HuggingFace — requires PERSONAL token, not org token ───────────
  if (!imageBuffer) {
    try {
      console.log('[pb/image] Trying HuggingFace…');
      imageBuffer = await fetchHuggingFace(imagePrompt, dims.width, dims.height);
      provider    = 'huggingface';
      console.log('[pb/image] HuggingFace OK');
    } catch (e: any) {
      console.warn('[pb/image] HuggingFace failed:', e.message);
      const hint = e.message.includes('permissions')
        ? 'HF token is an org token — use your personal HF token instead'
        : e.message;
      errors.push(`HuggingFace: ${hint}`);
    }
  }

  if (!imageBuffer) {
    return NextResponse.json({
      error: `All providers failed — ${errors.join(' | ')}`,
    }, { status: 500 });
  }

  const storedUrl = await persist(imageBuffer, platform, provider);
  const imageUrl  = storedUrl || toDataUrl(imageBuffer);

  return NextResponse.json({ imageUrl, storedUrl, prompt: imagePrompt, provider, platform, style });
}
