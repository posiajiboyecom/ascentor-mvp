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
// sharp + @napi-rs/canvas loaded lazily inside applyOverlay
// Trigger.dev imports this file to register the task.
// If OpenAI were init'd here, it would throw on import
// when OPENAI_API_KEY isn't in the environment yet.

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
  slide:       number;
  purpose:     "hook" | "context" | "conflict" | "moment" | "result" | "cta";
  text:        string;
  imagePrompt: string; // Claude-generated cinematic prompt unique to this slide
}

interface CarouselBrief {
  hook:     string;
  pillar:   ContentPillar;
  platform: Platform;
  slides:   SlideBrief[];
  caption:  string;
  hashtags: string[];
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

// ── No hardcoded scenes. Claude invents a unique visual for each slide. ──

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
// Uses Claude Sonnet as a creative director — it reads the hook,
// understands the emotional arc, and writes a unique cinematic
// image prompt for EACH slide from scratch. No template picking.
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
    model:      "claude-sonnet-4-6",
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content:
        `You are a world-class creative director and visual storyteller for a career platform serving ambitious purposeful individuals globally.\n\n` +

        `HOOK: "${hook}"\n` +
        `PILLAR: ${pillar} | PLATFORM: ${platform}\n\n` +

        `YOUR JOB:\n` +
        `1. Read the hook deeply. Understand the human story — the emotion, the stakes, the transformation.\n` +
        `2. Write 6 slides that tell this story with cinematic, varied visuals. Each slide must feel like a different scene in a short film.\n` +
        `3. For each slide, write a UNIQUE imagePrompt — a detailed, specific, photorealistic image generation prompt.\n\n` +

        `SLIDE STRUCTURE:\n` +
        `- Slide 1 (hook): The arresting opening image. Must stop the scroll. Bold, unexpected composition.\n` +
        `- Slide 2 (context): The "before" world. Grounded, slightly heavy. The situation before the change.\n` +
        `- Slide 3 (conflict): Tension at its peak. Something is wrong or hard. Visually uncomfortable.\n` +
        `- Slide 4 (moment): The pivot. The conversation, the question, the realisation. Something shifts.\n` +
        `- Slide 5 (result): The after. Lighter. More confident. Visually warmer and more open.\n` +
        `- Slide 6 (cta): Clean, aspirational, inviting. "${cta[platform]}"\n\n` +

        `IMAGE PROMPT RULES (apply to every imagePrompt):\n` +
        `- Be specific and cinematic — describe exact composition, angle, lighting, colour palette, mood\n` +
        `- Feature Black purposeful individuals in global professional settings\n` +
        `- Vary the visual concept completely across slides — never repeat the same setting or angle\n` +
        `- Use documentary/editorial photography style — real moments, not posed stock photos\n` +
        `- Suggest specific lighting: golden hour, laptop screen glow, harsh fluorescent, soft window light, etc.\n` +
        `- NO text, words, letters, signs, or captions in the image — ever\n` +
        `- Portrait orientation (vertical). Photorealistic. Cinematic quality.\n` +
        `- Each prompt must be 40–60 words. Specific enough to produce a distinct image every time.\n\n` +

        `VISUAL VARIETY MANDATE:\n` +
        `Across 6 slides you must use: different locations, different times of day, different shot types ` +
        `(wide/close/overhead/low angle), different colour temperatures (warm/cool/neutral), ` +
        `different number of people (solo/two/group). No two slides should look like they could be from the same photoshoot.\n\n` +

        `TEXT RULES:\n` +
        `- Slide texts: punchy, max 15 words each. First person. No corporate language.\n` +
        `- Slide 6 text = exactly: "${cta[platform]}"\n\n` +

        `caption: First person, past tense, 100–150 words. Conversational. Raw. No emojis, no exclamation marks. ` +
        `No words: leverage/synergy/impactful/journey/pivot/game-changer. Use \\n for line breaks.\n\n` +

        `Return a single JSON object:\n` +
        `{\n` +
        `  "hook": string,\n` +
        `  "pillar": string,\n` +
        `  "platform": string,\n` +
        `  "slides": [\n` +
        `    {"slide": number, "purpose": string, "text": string, "imagePrompt": string},\n` +
        `    ...\n` +
        `  ],\n` +
        `  "caption": string,\n` +
        `  "hashtags": ${JSON.stringify(tags[pillar])}\n` +
        `}`,
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
    const slide  = brief.slides[i];

    // Claude wrote a unique cinematic prompt for this slide in buildBrief
    const prompt = slide.imagePrompt
      ? `${slide.imagePrompt}\n\nNo text, words, letters, or captions anywhere in the image. Photorealistic. Cinematic quality. Portrait orientation.`
      : `Professional career moment. Cinematic. Black African professional. No text. Portrait orientation.`;

    logger.info(`[Carousel] Generating slide ${i + 1}/6 — ${slide.purpose}...`);

    try {
      const response = await openai.images.generate({
        model:   "gpt-image-1",
        prompt,
        size:    "1024x1024",  // square — cheapest size, upgrade to 1024x1536 when ready
        quality: "medium",        // $0.011/image — upgrade to "medium" ($0.063) or "high" ($0.25) when ready
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
      await applyOverlay(rawPath, slide.text, finalPath);

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
// STEP 4: Text overlay via sharp + SVG
//
// The garbled text issue was caused by SVG relying on system
// fonts that don't exist on the Trigger.dev worker.
// Fix: embed the font directly as base64 in the SVG so it
// always renders correctly regardless of what's installed.
// ════════════════════════════════════════════════════════════
async function applyOverlay(inputPath: string, text: string, outputPath: string): Promise<void> {
  try {
    const sharp = (await import("sharp")).default;

    const meta = await sharp(inputPath).metadata();
    const W    = meta.width  ?? 1024;
    const H    = meta.height ?? 1024;

    // Word-wrap
    const words     = text.split(" ");
    const lines: string[] = [];
    let   current   = "";
    const MAX_CHARS = Math.floor(W / 34);
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (test.length > MAX_CHARS && current) { lines.push(current); current = word; }
      else current = test;
    }
    if (current) lines.push(current);

    const FONT_SIZE   = Math.floor(W * 0.058);
    const LINE_HEIGHT = Math.floor(FONT_SIZE * 1.38);
    const SCRIM_TOP   = Math.floor(H * 0.52);
    const BLOCK_H     = lines.length * LINE_HEIGHT;
    const TEXT_Y      = SCRIM_TOP + Math.floor((H - SCRIM_TOP - BLOCK_H) / 2) + FONT_SIZE;
    const PAD         = Math.floor(W * 0.06);

    const escape = (s: string) => s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Each line: shadow offset then white on top
    const svgLines = lines.map((line, i) => {
      const y = TEXT_Y + i * LINE_HEIGHT;
      const l = escape(line);
      return [
        // thick black shadow for legibility on any background
        `<text x="${W/2}" y="${y+3}" text-anchor="middle" font-size="${FONT_SIZE}" font-weight="900" font-family="Impact, Arial Black, sans-serif" fill="black" opacity="0.85" stroke="black" stroke-width="6" stroke-linejoin="round">${l}</text>`,
        // crisp white text on top
        `<text x="${W/2}" y="${y}" text-anchor="middle" font-size="${FONT_SIZE}" font-weight="900" font-family="Impact, Arial Black, sans-serif" fill="white">${l}</text>`,
      ].join("\n");
    }).join("\n");

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="black" stop-opacity="0"/>
          <stop offset="30%"  stop-color="black" stop-opacity="0.60"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${SCRIM_TOP}" width="${W}" height="${H - SCRIM_TOP}" fill="url(#scrim)"/>
      ${svgLines}
    </svg>`;

    await sharp(inputPath)
      .composite([{ input: Buffer.from(svg), blend: "over" }])
      .jpeg({ quality: 92 })
      .toFile(outputPath);

    logger.info(`[Carousel] Overlay applied — ${lines.length} line(s): "${text.slice(0, 50)}"`);

  } catch (err: any) {
    fs.copyFileSync(inputPath, outputPath);
    logger.warn(`[Carousel] Overlay skipped (${err.message}) — raw image used`);
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
// STEP 5b: Generate + upload a txt file with all slide texts
// Uploaded alongside the images so you can copy/paste easily
// ════════════════════════════════════════════════════════════
async function uploadTextFile(brief: CarouselBrief, jobId: string): Promise<string | null> {
  try {
    const lines = [
      `CAROUSEL — ${brief.hook}`,
      `Pillar: ${brief.pillar} | Platform: ${brief.platform}`,
      `Generated: ${new Date().toISOString()}`,
      `${"─".repeat(60)}`,
      "",
      ...brief.slides.map(s =>
        `SLIDE ${s.slide} [${s.purpose.toUpperCase()}]\n${s.text}\n`
      ),
      `${"─".repeat(60)}`,
      "",
      "CAPTION:",
      brief.caption,
      "",
      `HASHTAGS: ${brief.hashtags.map(h => "#" + h).join(" ")}`,
    ].join("\n");

    const storagePath = `${SLIDE_FOLDER}/${jobId}/slide-texts.txt`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(lines, "utf-8"), {
        contentType: "text/plain",
        upsert: false,
      });

    if (error) { logger.warn(`[Carousel] txt upload failed: ${error.message}`); return null; }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`[Carousel] Slide texts uploaded → ${storagePath}`);
    return publicUrl;
  } catch (err: any) {
    logger.warn(`[Carousel] txt upload error: ${err.message}`);
    return null;
  }
}
async function saveToCalendar(
  brief: CarouselBrief,
  urls: string[],
  textFileUrl: string | null,
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
      content_data: {
        caption:        brief.caption,
        hashtags:       brief.hashtags,
        hook:           brief.hook,
        platform:       brief.platform,
        textFileUrl:    textFileUrl ?? null,
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
      const textFileUrl          = await uploadTextFile(brief, jobId);
      const calId                = await saveToCalendar(brief, urls, textFileUrl, week, triggeredBy);

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
