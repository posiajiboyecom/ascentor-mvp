// src/trigger/carousel-agent.ts
// ═══════════════════════════════════════════════════════════
// Agent 13: Carousel Content Agent
//
// FLOW:
//   1. Claude generates hooks (or uses ones you provide)
//   2. Claude builds 6-slide brief + caption per hook
//   3. GPT-image-1 generates 6 portrait images (1024x1536)
//   4. Pillow applies text overlays
//   5. Images uploaded to Supabase 'content-media' bucket
//   6. Rows saved to content_calendar (status: draft)
//   7. Posi reviews in Content Calendar → approves
//   8. Click Queue Social → social_queue → buffer-send → Buffer
//
// NEW ENV VAR:  OPENAI_API_KEY=sk-...
// NEW PACKAGE:  npm install openai --save
// OPTIONAL DEP: pip install Pillow
// ═══════════════════════════════════════════════════════════

import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic         from "@anthropic-ai/sdk";
import OpenAI            from "openai";
import { createClient }  from "@supabase/supabase-js";
import * as fs           from "fs";
import * as path         from "path";
import { execSync }      from "child_process";

// ── Anthropic + Supabase: safe to init at module level ───────
// ── OpenAI: lazy — initialised inside generateImages() ───────
// ── Trigger.dev imports this file to register the task.      ─
// ── If OpenAI were init'd here, it would throw on import     ─
// ── when OPENAI_API_KEY isn't in the environment yet.        ─
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET         = "content-media";
const SLIDE_FOLDER   = "carousel-slides";
const COST_PER_IMAGE = 0.063;


type ContentPillar = "leadership" | "career" | "ai" | "coaching" | "community";
type Platform      = "LinkedIn" | "Instagram" | "TikTok";

interface SlideBrief {
  slide:   number;
  purpose: "hook" | "context" | "conflict" | "moment" | "result" | "cta";
  text:    string;
}

interface CarouselBrief {
  hook:             string;
  pillar:           ContentPillar;
  platform:         Platform;
  sceneType:        "office" | "startup" | "mentorship" | "boardroom";
  slides:           SlideBrief[];
  styleProgression: string[];
  caption:          string;
  hashtags:         string[];
}

// ── JSON extractor — same pattern as content-writer.ts ───────
function extractJSON(raw: string): any {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(text); } catch { /* continue */ }

  function repair(s: string): string {
    let r = ""; let inStr = false; let esc = false;
    for (const ch of s) {
      if (esc) { r += ch; esc = false; continue; }
      if (ch === "\\") { esc = true; r += ch; continue; }
      if (ch === '"') { inStr = !inStr; r += ch; continue; }
      // Escape ANY literal control character inside a string
      if (inStr && ch === "\n") { r += "\\n"; continue; }
      if (inStr && ch === "\r") { r += "\\r"; continue; }
      if (inStr && ch === "\t") { r += "\\t"; continue; }
      r += ch;
    }
    return r;
  }

  try { return JSON.parse(repair(text)); } catch { /* continue */ }

  const s = Math.min(
    ...[text.indexOf("{"), text.indexOf("[")].filter(i => i !== -1)
  );
  if (s !== Infinity) {
    const closer = text[s] === "{" ? "}" : "]";
    const e = text.lastIndexOf(closer);
    if (e > s) {
      try { return JSON.parse(text.slice(s, e + 1)); } catch { /* */ }
      try { return JSON.parse(repair(text.slice(s, e + 1))); } catch { /* */ }
    }
  }
  throw new Error(`Cannot parse JSON. Raw: ${raw.slice(0, 200)}`);
}

const SYSTEM =
  "You are a JSON API. Respond with ONLY valid raw JSON. " +
  "No markdown fences, no text before or after JSON. " +
  "Represent all newlines inside strings as \\n. Never truncate.";

const FORMULA =
  "MASTER FORMULA — every hook maps to:\n" +
  "[PERSON] + [CONFLICT] → [ASCENTOR MOMENT] → [MIND CHANGED]\n\n" +
  "PERSON: Boss, manager, co-founder, investor, mentor, team, skip-level\n" +
  "CONFLICT: Said no · didn't believe · passed them over · was about to quit\n" +
  "ASCENTOR MOMENT: Mentor asked · I showed them · the framework revealed\n" +
  "MIND CHANGED: They agreed · I got promoted · everything shifted\n\n" +
  "HOOK RULES: max 18 words · named person · conflict present · " +
  "no features/pricing · no emojis · no exclamation marks · global framing";

const SCENE: Record<string, string> = {
  office:
    "iPhone photo of a modern open-plan office. Shot from a desk toward floor-to-ceiling " +
    "windows, city skyline, late afternoon light. One person back to camera at standing desk. " +
    "Laptop, coffee cup, phone face-down on desk. Grey carpet, white ceiling, pendant lighting. " +
    "Portrait orientation, natural phone camera quality, realistic lighting.",
  startup:
    "iPhone photo of a small co-working space. Shot from entrance diagonally across the room. " +
    "Two wooden desks, whiteboard with handwritten diagrams, one window with morning light. " +
    "Concrete floor, exposed ceiling, warm pendant bulbs. Open laptop, coffee cup, printed papers. " +
    "Portrait orientation, natural phone camera quality.",
  mentorship:
    "iPhone photo of two professionals talking at a round cafe table. Side angle shot, " +
    "large window on left, afternoon light. Laptop open, two coffee cups, notepad. " +
    "Warm ambient light, blurred background. Portrait orientation, natural phone camera quality.",
  boardroom:
    "iPhone photo of a modern boardroom. Shot from end of table toward presentation screen. " +
    "Eight chairs, glass walls, city view. Printed decks on table, water glasses. " +
    "Recessed lighting, dark wood table, grey carpet. Portrait orientation, natural phone camera quality.",
};

const STYLE: Record<string, string> = {
  tired:        "Muted palette. Overcast light. Lived-in feel.",
  frustrated:   "Cool desaturated tones. Harsh overhead light.",
  focused:      "Warmer tones. Clean surface. Single light source.",
  curious:      "Brighter ambient light. Laptop screen glow.",
  clarity:      "Crisp sharp light. Clean surfaces.",
  confident:    "Rich warm tones. Good natural light. Polished scene.",
  aspirational: "Bright golden hour light. Clean elevated feel.",
  corporate:    "Cool professional tones. Structured. Authoritative.",
};

// ════════════════════════════════════════════════════════════
// STEP 1: Get hooks
// ════════════════════════════════════════════════════════════
async function getHooks(
  pillar: ContentPillar,
  platform: Platform,
  postCount: number,
  provided?: string[]
): Promise<string[]> {
  if (provided && provided.length === postCount) {
    logger.info(`[Carousel] Using ${postCount} provided hook(s)`);
    return provided;
  }

  logger.info(`[Carousel] Generating ${postCount * 5} hook options...`);

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content:
        `${FORMULA}\n\n` +
        `Generate ${postCount * 5} hook options for Ascentor.\n` +
        `Pillar: ${pillar} | Platform: ${platform} | Slots: ${postCount} (5 per slot)\n\n` +
        `Return ONLY a JSON string array — ${postCount * 5} hooks total.\n["hook 1","hook 2",...]`,
    }],
  });

  const raw  = res.content[0].type === "text" ? res.content[0].text : "[]";
  const all: string[] = extractJSON(raw);

  const selected: string[] = [];
  for (let i = 0; i < postCount; i++) {
    const opts = all.slice(i * 5, i * 5 + 5);
    selected.push(
      opts.find(h => h.split(" ").length <= 18) ??
      opts[0] ??
      `My mentor changed my approach to ${pillar}.`
    );
  }
  logger.info(`[Carousel] Selected ${selected.length} hook(s)`);
  return selected;
}

// ════════════════════════════════════════════════════════════
// STEP 2: Build brief per hook
// ════════════════════════════════════════════════════════════
async function buildBrief(
  hook: string,
  pillar: ContentPillar,
  platform: Platform
): Promise<CarouselBrief> {
  const cta: Record<Platform, string> = {
    LinkedIn:  "Get a mentor who's been where you want to go. Ascentor.com",
    TikTok:    "Find your mentor at Ascentor.com — link in bio.",
    Instagram: "Your mentor is on Ascentor. Link in bio.",
  };

  const tags: Record<ContentPillar, string[]> = {
    career:     ["careeradvice", "promotion", "careerdevelopment", "leadership", "worksmarter"],
    leadership: ["leadership", "managertips", "teammanagement", "leadershipdevelopment", "executivepresence"],
    ai:         ["AIleadership", "futureofwork", "AItools", "careerdevelopment", "leadership"],
    coaching:   ["coaching", "mentorship", "careerdevelopment", "leadership", "personaldevelopment"],
    community:  ["community", "networking", "careerdevelopment", "leadership", "professionalgrowth"],
  };

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{
      role: "user",
      content:
        `${FORMULA}\n\n` +
        `Build a 6-slide carousel brief.\n` +
        `Hook: "${hook}" | Pillar: ${pillar} | Platform: ${platform}\n\n` +
        `SLIDE RULES:\n` +
        `- slide 1: purpose "hook", text = hook verbatim (max 18 words)\n` +
        `- slide 2: purpose "context", text max 30 words\n` +
        `- slide 3: purpose "conflict", text max 30 words\n` +
        `- slide 4: purpose "moment", text max 30 words\n` +
        `- slide 5: purpose "result", text max 30 words\n` +
        `- slide 6: purpose "cta", text = exactly "${cta[platform]}"\n\n` +
        `sceneType must be one of: office, startup, mentorship, boardroom\n` +
        `styleProgression must be exactly: ["tired","focused","curious","clarity","confident","aspirational"]\n` +
        `caption: first person, past tense, max 150 words, no emojis, no exclamation marks, ` +
        `no leverage/synergy/impactful/journey. Use \\n for line breaks inside the string.\n` +
        `hashtags: ${JSON.stringify(tags[pillar])}\n\n` +
        `Return a single JSON object matching this shape exactly:\n` +
        `{ "hook": string, "pillar": string, "platform": string, "sceneType": string, ` +
        `"slides": [{"slide":number,"purpose":string,"text":string},...], ` +
        `"styleProgression": [string,...], "caption": string, "hashtags": [string,...] }`,
    }],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
  return extractJSON(raw) as CarouselBrief;
}

// ════════════════════════════════════════════════════════════
// STEP 3: Generate images
// NOTE: OpenAI client is initialised HERE — not at module level.
// This prevents Trigger.dev from crashing on import when
// OPENAI_API_KEY is not yet set in the local environment.
//
// FIX: gpt-image-1 returns base64 (b64_json) by default, not a URL.
// We handle both response shapes so it works regardless of how
// OpenAI decides to return the image.
// ════════════════════════════════════════════════════════════
async function generateImages(
  brief: CarouselBrief,
  jobId: string
): Promise<{ localPaths: string[]; cost: number }> {

  // ── Lazy init — safe to create here at runtime ─────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const dir = path.join("/tmp", "ascentor-carousel", jobId);
  fs.mkdirSync(dir, { recursive: true });

  const localPaths: string[] = [];
  let cost = 0;

  for (let i = 0; i < brief.slides.length; i++) {
    const slide = brief.slides[i];
    const mood  = brief.styleProgression[i] ?? "confident";
    const style = slide.purpose === "cta"
      ? "Bright golden hour light. Clean elevated aspirational feel."
      : (STYLE[mood] ?? "Warm professional tones.");

    const prompt =
      `${SCENE[brief.sceneType] ?? SCENE.office}\n\n` +
      `Style: ${style}\n\n` +
      `Text overlay in lower third: "${slide.text}"\n` +
      `Large bold white sans-serif. High contrast. Legible at small size.\n` +
      `Dark semi-transparent gradient behind text. No other text in scene.`;

    logger.info(`[Carousel] Generating slide ${i + 1}/6 — ${slide.purpose}...`);

    try {
      const response = await openai.images.generate({
        model:   "gpt-image-1",
        prompt,
        size:    "1024x1536",  // ALWAYS portrait — never change this
        quality: "medium",
        n:       1,
      });

      const item = response.data?.[0];

      // ── gpt-image-1 returns b64_json by default, not a URL ──
      let imageBuffer: Buffer;
      if (item?.b64_json) {
        logger.info(`[Carousel] Slide ${i + 1} received as base64`);
        imageBuffer = Buffer.from(item.b64_json, "base64");
      } else if (item?.url) {
        logger.info(`[Carousel] Slide ${i + 1} received as URL`);
        imageBuffer = Buffer.from(await (await fetch(item.url)).arrayBuffer());
      } else {
        throw new Error(`No image data for slide ${i + 1} — response: ${JSON.stringify(response.data)}`);
      }

      const rawPath   = path.join(dir, `slide-${i + 1}-raw.jpg`);
      const finalPath = path.join(dir, `slide-${i + 1}.jpg`);
      fs.writeFileSync(rawPath, imageBuffer);
      applyOverlay(rawPath, slide.text, finalPath);

      localPaths.push(finalPath);
      cost += COST_PER_IMAGE;

      if (i < brief.slides.length - 1) await sleep(2000);
    } catch (err) {
      logger.error(`[Carousel] Slide ${i + 1} failed: ${err}`);
      localPaths.push("");
    }
  }

  logger.info(`[Carousel] ${localPaths.filter(Boolean).length}/6 images ready`);
  return { localPaths, cost };
}

// ════════════════════════════════════════════════════════════
// STEP 4: Text overlay via Pillow
// ════════════════════════════════════════════════════════════
function applyOverlay(inputPath: string, text: string, outputPath: string): void {
  const script = `
import sys
from PIL import Image, ImageDraw, ImageFont
import textwrap
img = Image.open(sys.argv[1]).convert('RGBA')
W, H = img.size
zt = int(H * 0.60)
from PIL import Image as I2
ov = I2.new('RGBA', img.size, (0,0,0,0))
ImageDraw.Draw(ov).rectangle([(0,zt),(W,H)], fill=(0,0,0,155))
img = I2.alpha_composite(img, ov)
draw = ImageDraw.Draw(img)
font = None
for fp in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
           '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
           '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf']:
    try: font = ImageFont.truetype(fp, 64); break
    except: continue
if not font: font = ImageFont.load_default()
lines = textwrap.wrap(sys.argv[2], width=22)
lh = 78
y0 = zt + ((H - zt) - len(lines)*lh) // 2
for i, ln in enumerate(lines):
    bb = draw.textbbox((0,0), ln, font=font)
    x = max(40, (W - (bb[2]-bb[0])) // 2)
    y = y0 + i*lh
    draw.text((x+2,y+2), ln, font=font, fill=(0,0,0,200))
    draw.text((x,y), ln, font=font, fill=(255,255,255,255))
img.convert('RGB').save(sys.argv[3], 'JPEG', quality=95)
`;
  fs.writeFileSync("/tmp/ascentor-overlay.py", script);
  try {
    execSync(
      `python3 /tmp/ascentor-overlay.py "${inputPath}" "${text.replace(/"/g, '\\"')}" "${outputPath}"`,
      { stdio: "pipe" }
    );
  } catch {
    fs.copyFileSync(inputPath, outputPath);
    logger.warn("[Carousel] Pillow unavailable — raw image used. Run: pip install Pillow");
  }
}

// ════════════════════════════════════════════════════════════
// STEP 5: Upload to Supabase storage
// ════════════════════════════════════════════════════════════
async function uploadImages(localPaths: string[], jobId: string): Promise<string[]> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
    });
  }

  const urls: string[] = [];
  for (let i = 0; i < localPaths.length; i++) {
    const p = localPaths[i];
    if (!p || !fs.existsSync(p)) { urls.push(""); continue; }

    const storagePath = `${SLIDE_FOLDER}/${jobId}/slide-${i + 1}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fs.readFileSync(p), {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      logger.error(`[Carousel] Upload slide ${i + 1}: ${error.message}`);
      urls.push("");
      continue;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    urls.push(publicUrl);
    logger.info(`[Carousel] Slide ${i + 1} uploaded`);
  }
  return urls;
}

// ════════════════════════════════════════════════════════════
// STEP 6: Save to content_calendar
// ════════════════════════════════════════════════════════════
async function saveToCalendar(
  brief: CarouselBrief,
  urls: string[],
  week: number,
  triggeredBy: string
): Promise<string> {
  const { data, error } = await supabase
    .from("content_calendar")
    .insert({
      pillar:       brief.pillar,
      type:         "Instagram Carousel" as any,
      title:        brief.hook.substring(0, 255),
      platform:     brief.platform === "LinkedIn" ? "LinkedIn" : "Instagram",
      week,
      status:       "draft",
      triggered_by: triggeredBy,
      content_data: {
        caption:          brief.caption,
        hashtags:         brief.hashtags,
        hook:             brief.hook,
        platform:         brief.platform,
        sceneType:        brief.sceneType,
        styleProgression: brief.styleProgression,
        slides: brief.slides.map((s, i) => ({
          slide:    s.slide,
          purpose:  s.purpose,
          text:     s.text,
          imageUrl: urls[i] ?? null,
        })),
        coverImageUrl:  urls[0] ?? null,
        allImagesReady: urls.filter(Boolean).length === 6,
        generatedAt:    new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(`content_calendar insert failed: ${error.message}`);
  logger.info(`[Carousel] Saved — id: ${data.id}`);
  return data.id;
}

// ════════════════════════════════════════════════════════════
// MAIN TASK
// ════════════════════════════════════════════════════════════
export const carouselAgentTask = task({
  id: "carousel-agent",
  maxDuration: 300,

  run: async (payload: {
    pillar:       ContentPillar;
    platform:     Platform;
    postCount?:   number;
    week?:        number;
    hooks?:       string[];
    triggeredBy?: string;
  }) => {
    const {
      pillar,
      platform,
      postCount   = 3,
      week        = Math.ceil(new Date().getDate() / 7),
      hooks,
      triggeredBy = "manual",
    } = payload;

    logger.info(`[Carousel] ▶ pillar:${pillar} platform:${platform} posts:${postCount}`);

    const approvedHooks = await getHooks(pillar, platform, postCount, hooks);
    const results: { calendarId: string; hook: string; slidesReady: number }[] = [];
    let totalCost = 0;

    for (const hook of approvedHooks) {
      logger.info(`[Carousel] Processing: "${hook.slice(0, 60)}..."`);

      const brief                = await buildBrief(hook, pillar, platform);
      const jobId                = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { localPaths, cost } = await generateImages(brief, jobId);
      totalCost                 += cost;
      const urls                 = await uploadImages(localPaths, jobId);
      const calId                = await saveToCalendar(brief, urls, week, triggeredBy);

      // Cleanup tmp files
      localPaths.forEach(p => { try { if (p) fs.unlinkSync(p); } catch { /* */ } });

      results.push({ calendarId: calId, hook, slidesReady: urls.filter(Boolean).length });
    }

    logger.info(`[Carousel] ✓ ${results.length} posts saved. Cost: $${totalCost.toFixed(2)}`);

    return {
      success:        true,
      postsGenerated: results.length,
      results,
      estimatedCost:  `$${totalCost.toFixed(2)}`,
      nextStep:
        "Open Content Calendar → filter Instagram Carousel → " +
        "review → approve → Queue Social → Buffer schedules",
    };
  },
});

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
