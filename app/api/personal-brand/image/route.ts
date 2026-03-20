// POST /api/admin/personal-brand/image
// Generates a social media image using fal.ai FLUX model
// Designed for cybersecurity personal brand posts (LinkedIn + Twitter/X)
//
// Body: { postContent?, style, platform, customPrompt? }
// Returns: { imageUrl, storedUrl, prompt }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  linkedin: { width: 1200, height: 627 },
  twitter:  { width: 1200, height: 675 },
  square:   { width: 1080, height: 1080 },
};

// Ascentor brand tokens:
// Dark: #0C0B08 (near-black)  Gold: #E8A020  Warm parchment: #F5F3EE / #FAF7F2
// Mid-tone: #4A4438  Cream: #F2EDE4  Border: #DDD5C8
const STYLE_CONTEXT: Record<string, string> = {
  dark_gold:      'Near-black background #0C0B08, warm gold #E8A020 as the dominant accent, cinematic lighting, editorial quality, sophisticated, no text or words',
  light_warm:     'Warm parchment background #F5F3EE or #FAF7F2, rich gold #E8A020 accents, soft cream tones #F2EDE4, airy and professional, editorial quality, no text',
  dark_contrast:  'Deep near-black #0C0B08 background, bold warm gold #E8A020 geometric shapes, cream #F2EDE4 highlights, high contrast, cinematic, no text',
  light_editorial:'Cream and parchment tones #F2EDE4 #F5F3EE, warm mid-tone shadows #4A4438, gold #E8A020 focal element, clean editorial magazine style, no text',
  gradient_brand: 'Gradient from warm parchment #FAF7F2 to near-black #0C0B08, gold #E8A020 accent line or glow, sophisticated transition, luxury feel, no text',
  terminal:       'Dark near-black #0C0B08 background, warm gold #E8A020 monospace glow effect, subtle amber scanlines, cybersecurity aesthetic with Ascentor warmth, no text',
  abstract_gold:  'Abstract geometric network nodes and flowing lines, alternating near-black #0C0B08 and warm parchment #F5F3EE zones, gold #E8A020 connectors, sophisticated, no text',
};

async function refinePrompt(postContent: string, style: string, platform: string): Promise<string> {
  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Creative director for professional cybersecurity personal brand imagery.

Write a concise image generation prompt (max 60 words) based on this ${platform} post. The image must:
- Complement the post theme visually without repeating it literally
- Style: ${STYLE_CONTEXT[style] || style}
- No text, no logos, no words anywhere in the image
- Photorealistic or high-quality digital art, never cartoonish
- Professional, dark, sophisticated

POST: ${postContent.slice(0, 400)}

Return ONLY the prompt, nothing else.`,
    }],
  });
  return (msg.content[0] as any).text?.trim() || 'Professional cybersecurity abstract concept, dark minimal, no text';
}

export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { postContent = '', style = 'dark_minimal', platform = 'linkedin', customPrompt = '' } = await req.json();

  const falKey = process.env.FAL_KEY;
  if (!falKey) return NextResponse.json({ error: 'FAL_KEY not set — add to Vercel environment variables' }, { status: 500 });

  try {
    const dims = DIMENSIONS[platform] || DIMENSIONS.linkedin;

    const imagePrompt = customPrompt.trim()
      ? `${customPrompt.trim()}, ${STYLE_CONTEXT[style] || ''}, no text`
      : postContent.trim()
      ? await refinePrompt(postContent, style, platform)
      : `Professional cybersecurity concept, ${STYLE_CONTEXT[style]}, editorial quality`;

    const falRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: imagePrompt,
        image_size: { width: dims.width, height: dims.height },
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!falRes.ok) {
      const err = await falRes.text();
      return NextResponse.json({ error: 'fal.ai error: ' + err }, { status: 500 });
    }

    const falData = await falRes.json();
    const falImageUrl: string = falData?.images?.[0]?.url;
    if (!falImageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 });

    // Persist to Supabase storage
    let storedUrl = falImageUrl;
    try {
      const imgRes = await fetch(falImageUrl);
      const buf = await imgRes.arrayBuffer();
      const filename = `personal-brand/${Date.now()}-${platform}.png`;
      const { error: upErr } = await service.storage
        .from('content-media')
        .upload(filename, buf, { contentType: 'image/png', upsert: false });
      if (!upErr) {
        const { data: { publicUrl } } = service.storage.from('content-media').getPublicUrl(filename);
        storedUrl = publicUrl;
      }
    } catch { /* non-fatal — fal URL still works short-term */ }

    return NextResponse.json({ imageUrl: falImageUrl, storedUrl, prompt: imagePrompt, platform, style });

  } catch (err: any) {
    console.error('[personal-brand/image]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
