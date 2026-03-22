// src/trigger/carousel-agent.ts
// ═══════════════════════════════════════════════════════════
// Agent 13: Carousel Content Agent
//
// FLOW:
//   1. Claude generates hooks (or validates provided ones)
//   2. Claude builds 6-slide brief + caption per hook
//   3. GPT-image-1 generates 6 portrait images per post
//   4. Pillow applies text overlays
//   5. Images uploaded to Supabase 'content-media' bucket
//   6. Saved to content_calendar as draft (type: Instagram Carousel)
//   7. Posi reviews in Content Calendar → approves
//   8. handleQueueSocial() in ContentInner.tsx queues to social_queue
//      with image_url → buffer-send route fires → Buffer schedules it
//
// FILE LOCATION: src/trigger/carousel-agent.ts
// TRIGGER ID:    "carousel-agent"
// AGENT ID:      "13" in AGENT_REGISTRY
//
// NEW ENV VAR NEEDED:
//   OPENAI_API_KEY=sk-...
//
// NEW NPM PACKAGE NEEDED:
//   npm install openai
//
// PYTHON DEP (optional — falls back gracefully if missing):
//   pip install Pillow
// ═══════════════════════════════════════════════════════════

import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic         from "@anthropic-ai/sdk";
import OpenAI            from "openai";
import { createClient }  from "@supabase/supabase-js";
import * as fs           from "fs";
import * as path         from "path";
import { execSync }      from "child_process";

// ── Clients — same pattern as all other triggers ─────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Constants ─────────────────────────────────────────────────
const BUCKET         = "content-media";          // same bucket as upload-media route
const SLIDE_FOLDER   = "carousel-slides";
const COST_PER_IMAGE = 0.10;                     // GPT-image-1 high quality estimate

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

// ── Robust JSON extractor — same pattern as content-writer.ts ─
function extractJSON(raw: string): any {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(text); } catch { /* continue */ }

  function repairJSON(s: string): string {
    let result = ""; let inString = false; let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) { result += ch; escape = false; continue; }
      if (ch === "\\") { escape = true; result += ch; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }
      if (inString) {
        if (ch === "\n") { result += "\\n"; continue; }
        else if (ch === "\r") { result += "\\r"; continue; }
        else if (ch === "\t") { result += "\\t"; continue; }
      }
      result += ch;
    }
    return result;
  }

  try { return JSON.parse(repairJSON(text)); } catch { /* continue */ }

  const firstBrace   = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const start = firstBrace === -1 ? firstBracket :
                firstBracket === -1 ? firstBrace :
                Math.min(firstBrace, firstBracket);

  if (start !== -1) {
    const closer    = text[start] === "{" ? "}" : "]";
    const lastClose = text.lastIndexOf(closer);
    if (lastClose > start) {
      const slice = text.slice(start, lastClose + 1);
      try { return JSON.parse(slice); } catch { /* */ }
      try { return JSON.parse(repairJSON(slice)); } catch { /* */ }
    }
  }
  throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 200)}`);
}

// ── System prompt — JSON enforcement (same as content-writer) ─
const SYSTEM =
  "You are a JSON API. Respond with ONLY valid raw JSON. " +
  "Never use markdown code fences, backticks, or any text before or after the JSON. " +
  "CRITICAL: All string values must be on ONE logical line — represent newlines as \\n. " +
  "Never truncate the response.";

// ── Ascentor brand + formula ──────────────────────────────────
const MASTER_FORMULA =
  "MASTER FORMULA — every hook must map to this:\n" +
  "[PERSON] + [CONFLICT/DOUBT] → [ASCENTOR MOMENT] → [MIND CHANGED]\n\n" +
  "PERSON: Boss, manager, co-founder, investor, mentor, team, skip-level, board\n" +
  "CONFLICT: Said no · didn't believe · passed them over · was about to quit\n" +
  "ASCENTOR MOMENT: Mentor asked · I showed them · the framework revealed\n" +
  "MIND CHANGED: They agreed · I got promoted · everything shifted\n\n" +
  "HOOK RULES:\n" +
  "- Maximum 18 words\n" +
  "- Must contain a named person/relationship AND a conflict or doubt\n" +
  "- Ascentor/mentor is the vehicle, not the subject\n" +
  "- Creates a question in the reader's mind ('what happened next?')\n" +
  "- NEVER mention features, pricing, or platform benefits directly\n" +
  "- NO emojis, NO exclamation marks, NO corporate language\n" +
  "- Global framing — no region-specific language\n";

// ── Scene architectures — locked across all 6 slide prompts ──
const SCENE: Record<string, string> = {
  office:
    "iPhone photo of a modern open-plan office. Shot from a desk looking toward " +
    "floor-to-ceiling windows, city skyline visible, late afternoon light. Mid-shot. " +
    "One person (back to camera, professional attire) seated at a standing desk. " +
    "Clean desk surface, laptop, coffee cup, phone face-down. Neutral grey carpet, " +
    "white ceiling, pendant lighting. Portrait orientation, natural phone camera quality.",

  startup:
    "iPhone photo of a small modern co-working space. Shot from the entrance looking " +
    "diagonally across the room. Two wooden desks visible, whiteboard on right wall with " +
    "handwritten diagrams, one window on far wall letting in morning light. Concrete floor, " +
    "exposed ceiling, warm pendant bulbs. Open laptop, coffee cup, printed papers. " +
    "Mid-shot. Portrait orientation, natural phone camera quality.",

  mentorship:
    "iPhone photo of two professionals in conversation at a round table in a quiet cafe " +
    "corner. Shot from side angle, table in foreground, large window on left wall, " +
    "afternoon light. Laptop open on table, two coffee cups, notepad and pen. Warm " +
    "ambient light, background blurred. Mid-shot. Portrait orientation, natural phone camera quality.",

  boardroom:
    "iPhone photo of a modern boardroom. Shot from the end of the table looking toward " +
    "the presentation screen. Eight chairs visible, glass walls on right side, city view. " +
    "Printed decks on table, water glasses, someone's phone resting near a chair. " +
    "Overhead recessed lighting, dark wood table, grey carpet. Mid-shot. Portrait orientation, " +
    "natural phone camera quality.",
};

const STYLE: Record<string, string> = {
  tired:        "Slightly dull, muted palette. Overcast light. Lived-in feel.",
  frustrated:   "Cool, desaturated tones. Harsh overhead light. Tension in composition.",
  focused:      "Warmer tones returning. Clean surface. Single source of light. Purposeful.",
  curious:      "Brighter ambient light. Laptop screen glow. Open body language.",
  clarity:      "Crisp sharp light. Clean surfaces. One strong directional light source.",
  confident:    "Rich warm tones. Good natural light. Polished, composed scene.",
  aspirational: "Bright airy golden hour light. Clean and elevated. The destination feel.",
  corporate:    "Cool professional tones. Structured. Authoritative.",
};

// ════════════════════════════════════════════════════════════
// STEP 1: Generate or validate hooks
// ════════════════════════════════════════════════════════════

async function getHooks(
  pillar: ContentPillar,
  platform: Platform,
  postCount: number,
  providedHooks?: string[]
): Promise<string[]> {

  // If Posi provided exactly the right number, use them directly
  if (providedHooks && providedHooks.length === postCount) {
    logger.info(`[Carousel] Using ${postCount} provided hook(s) from hook bank`);
    return providedHooks;
  }

  logger.info(`[Carousel] Generating ${postCount * 5} hook options via Claude...`);

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content:
        `${MASTER_FORMULA}\n\n` +
        `Generate ${postCount * 5} hook options for Ascentor carousel posts.\n` +
        `Pillar: ${pillar} | Platform: ${platform}\n` +
        `Slots: ${postCount} (generate 5 options per slot)\n\n` +
        `Return ONLY a JSON array of strings — ${postCount * 5} hooks total.\n` +
        `["hook 1", "hook 2", ...]`,
    }],
  });

  const raw   = res.content[0].type === "text" ? res.content[0].text : "[]";
  const all: string[] = extractJSON(raw);

  // Auto-select best from each slot (first that passes 18-word rule)
  const selected: string[] = [];
  for (let slot = 0; slot < postCount; slot++) {
    const options = all.slice(slot * 5, slot * 5 + 5);
    const best    = options.find(h => h.split(" ").length <= 18) ?? options[0];
    selected.push(best ?? `My mentor changed how I think about ${pillar}.`);
  }

  logger.info(`[Carousel] Selected ${selected.length} hook(s)`);
  return selected;
}

// ════════════════════════════════════════════════════════════
// STEP 2: Generate carousel brief per hook
// ════════════════════════════════════════════════════════════

async function buildBrief(
  hook: string,
  pillar: ContentPillar,
  platform: Platform
): Promise<CarouselBrief> {

  const ctaText: Record<Platform, string> = {
    LinkedIn:  "Get a mentor who's been where you want to go. Ascentor.com",
    TikTok:    "Find your mentor at Ascentor.com — link in bio.",
    Instagram: "Your mentor is on Ascentor. Link in bio.",
  };

  const hashtagMap: Record<ContentPillar, string[]> = {
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
        `${MASTER_FORMULA}\n\n` +
        `Generate a complete 6-slide carousel brief for this hook:\n` +
        `Hook: "${hook}"\nPillar: ${pillar}\nPlatform: ${platform}\n\n` +
        `SLIDE WORD LIMITS:\n` +
        `- Slide 1 (hook): verbatim or very close to the hook — max 18 words\n` +
        `- Slides 2–5: max 30 words each\n` +
        `- Slide 6 (cta): exactly "${ctaText[platform]}"\n\n` +
        `CAPTION RULES:\n` +
        `- First person, past tense, max 150 words\n` +
        `- No emojis, no exclamation marks\n` +
        `- No corporate language ("leverage", "synergy", "impactful", "journey")\n` +
        `- Represent newlines as \\n\n\n` +
        `Return ONLY this JSON:\n` +
        `{\n` +
        `  "hook": "${hook}",\n` +
        `  "pillar": "${pillar}",\n` +
        `  "platform": "${platform}",\n` +
        `  "sceneType": "office|startup|mentorship|boardroom",\n` +
        `  "slides": [\n` +
        `    {"slide":1,"purpose":"hook","text":"..."},\n` +
        `    {"slide":2,"purpose":"context","text":"..."},\n` +
        `    {"slide":3,"purpose":"conflict","text":"..."},\n` +
        `    {"slide":4,"purpose":"moment","text":"..."},\n` +
        `    {"slide":5,"purpose":"result","text":"..."},\n` +
        `    {"slide":6,"purpose":"cta","text":"${ctaText[platform]}"}\n` +
        `  ],\n` +
        `  "styleProgression": ["tired","focused","curious","clarity","confident","aspirational"],\n` +
        `  "caption": "caption text with \\n for line breaks",\n` +
        `  "hashtags": ${JSON.stringify(hashtagMap[pillar])}\n` +
        `}`,
    }],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
  return extractJSON(raw) as CarouselBrief;
}

// ════════════════════════════════════════════════════════════
// STEP 3: Generate images via GPT-image-1
// ════════════════════════════════════════════════════════════

async function generateImages(
  brief: CarouselBrief,
  jobId: string
): Promise<{ localPaths: string[]; cost: number }> {

  const architecture = SCENE[brief.sceneType] ?? SCENE.office;
  const tmpDir = path.join("/tmp", "ascentor-carousel", jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const localPaths: string[] = [];
  let cost = 0;

  for (let i = 0; i < brief.slides.length; i++) {
    const slide = brief.slides[i];
    const mood  = brief.styleProgression[i] ?? "confident";
    const style = slide.purpose === "cta"
      ? "Bright airy golden hour light. Clean and elevated. Aspirational destination feel."
      : (STYLE[mood] ?? `${mood} mood. Warm professional tones.`);

    const prompt =
      `${architecture}\n\nStyle: ${style}\n\n` +
      `Text overlay in lower third: "${slide.text}"\n` +
      `Large bold white sans-serif font. High contrast. Legible at small size.\n` +
      `Dark semi-transparent gradient behind text zone. No other text in scene.`;

    logger.info(`[Carousel] Generating slide ${i + 1}/6 — ${slide.purpose}...`);

    try {
      const response = await openai.images.generate({
        model:   "gpt-image-1",
        prompt,
        size:    "1024x1536",  // ALWAYS portrait — hardcoded, never changes
        quality: "high",
        n:       1,
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) throw new Error(`No URL returned for slide ${i + 1}`);

      // Download image to tmp
      const rawPath   = path.join(tmpDir, `slide-${i + 1}-raw.jpg`);
      const finalPath = path.join(tmpDir, `slide-${i + 1}.jpg`);
      const imgRes    = await fetch(imageUrl);
      fs.writeFileSync(rawPath, Buffer.from(await imgRes.arrayBuffer()));

      // Apply text overlay
      applyTextOverlay(rawPath, slide.text, finalPath);

      localPaths.push(finalPath);
      cost += COST_PER_IMAGE;

      // Respect GPT-image-1 rate limits
      if (i < brief.slides.length - 1) await sleep(2000);

    } catch (err) {
      logger.error(`[Carousel] Slide ${i + 1} failed: ${err}`);
      localPaths.push(""); // keep index alignment
    }
  }

  logger.info(`[Carousel] Generated ${localPaths.filter(Boolean).length}/6 images`);
  return { localPaths, cost };
}

// ════════════════════════════════════════════════════════════
// STEP 4: Apply text overlay via Python/Pillow
// ════════════════════════════════════════════════════════════

function applyTextOverlay(inputPath: string, text: string, outputPath: string): void {
  const script = `
import sys
from PIL import Image, ImageDraw, ImageFont
import textwrap

input_path, text, output_path = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(input_path).convert('RGBA')
W, H = img.size  # 1024 x 1536

text_zone_top = int(H * 0.60)
overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
ImageDraw.Draw(overlay).rectangle([(0, text_zone_top), (W, H)], fill=(0, 0, 0, 155))
img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img)

# Try common bold fonts in order
font_size = 64  # never below 56px
font = None
for fp in [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
]:
    try: font = ImageFont.truetype(fp, font_size); break
    except: continue
if not font: font = ImageFont.load_default()

wrapped   = textwrap.wrap(text, width=22)  # max 22 chars per line
line_h    = font_size + 14
total_h   = len(wrapped) * line_h
zone_h    = H - text_zone_top
y_start   = text_zone_top + (zone_h - total_h) // 2
y_start   = max(y_start, text_zone_top + 20)

for i, line in enumerate(wrapped):
    bbox = draw.textbbox((0, 0), line, font=font)
    x    = max(40, (W - (bbox[2] - bbox[0])) // 2)
    y    = y_start + i * line_h
    draw.text((x + 2, y + 2), line, font=font, fill=(0, 0, 0, 200))  # shadow
    draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))      # white

img.convert('RGB').save(output_path, 'JPEG', quality=95)
`;

  const scriptPath = "/tmp/ascentor-overlay.py";
  fs.writeFileSync(scriptPath, script);

  try {
    execSync(
      `python3 "${scriptPath}" "${inputPath}" "${text.replace(/"/g, '\\"')}" "${outputPath}"`,
      { stdio: "pipe" }
    );
  } catch {
    // Pillow not installed — use raw image, log warning, continue
    fs.copyFileSync(inputPath, outputPath);
    logger.warn(`[Carousel] Pillow unavailable — raw image used (no text overlay). Run: pip install Pillow`);
  }
}

// ════════════════════════════════════════════════════════════
// STEP 5: Upload to Supabase 'content-media' bucket
// Returns array of 6 public URLs (matching your existing bucket)
// ════════════════════════════════════════════════════════════

async function uploadToStorage(
  localPaths: string[],
  jobId: string
): Promise<string[]> {

  // Ensure bucket exists (same check as upload-media route)
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 8 * 1024 * 1024 });
    logger.info(`[Carousel] Created bucket: ${BUCKET}`);
  }

  const publicUrls: string[] = [];

  for (let i = 0; i < localPaths.length; i++) {
    const localPath = localPaths[i];
    if (!localPath || !fs.existsSync(localPath)) {
      publicUrls.push(""); // keep index alignment
      continue;
    }

    const storagePath = `${SLIDE_FOLDER}/${jobId}/slide-${i + 1}.jpg`;
    const buffer      = fs.readFileSync(localPath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: "image/jpeg",
        upsert:      false,
      });

    if (error) {
      logger.error(`[Carousel] Upload failed for slide ${i + 1}: ${error.message}`);
      publicUrls.push("");
      continue;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    publicUrls.push(publicUrl);
    logger.info(`[Carousel] Slide ${i + 1} uploaded → ${publicUrl}`);
  }

  return publicUrls;
}

// ════════════════════════════════════════════════════════════
// STEP 6: Save to content_calendar
// Matches your existing DB schema exactly
// ════════════════════════════════════════════════════════════

async function saveToCalendar(
  brief: CarouselBrief,
  publicUrls: string[],
  week: number,
  triggeredBy: string
): Promise<string> {

  // Platform → what your social queue + buffer-send understands
  // TikTok goes as Instagram (Buffer routes it via the same media upload flow)
  const platformLabel =
    brief.platform === "LinkedIn" ? "LinkedIn" : "Instagram";

  // Build content_data JSONB — same structure as other carousel-type content
  // The caption + hashtags are what handleQueueSocial() extracts for postContent
  const contentData = {
    // These fields match what handleQueueSocial reads for Instagram types:
    caption:  brief.caption,
    hashtags: brief.hashtags,
    // Full carousel data for the detail panel in ContentInner.tsx:
    hook:             brief.hook,
    platform:         brief.platform,
    sceneType:        brief.sceneType,
    styleProgression: brief.styleProgression,
    slides: brief.slides.map((s, i) => ({
      slide:    s.slide,
      purpose:  s.purpose,
      text:     s.text,
      imageUrl: publicUrls[i] ?? null,
    })),
    // slide1ImageUrl = the cover image shown as preview / sent as image_url to Buffer
    coverImageUrl: publicUrls[0] ?? null,
    allImagesReady: publicUrls.filter(Boolean).length === 6,
    generatedAt: new Date().toISOString(),
    estimatedCost: `$${(publicUrls.filter(Boolean).length * COST_PER_IMAGE).toFixed(2)}`,
  };

  const { data, error } = await supabase
    .from("content_calendar")
    .insert({
      pillar:       brief.pillar,
      // 'Instagram Carousel' extends your ContentType — add it to the DB enum if needed
      // or use the existing closest type. Your ContentInner.tsx already handles
      // item.type?.startsWith('Instagram') so this works with your existing UI.
      type:         "Instagram Carousel" as any,
      title:        brief.hook.substring(0, 255),
      platform:     platformLabel,
      week,
      status:       "draft",
      content_data: contentData,
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(`content_calendar insert failed: ${error.message}`);

  logger.info(`[Carousel] Saved to content_calendar — id: ${data.id}`);
  return data.id;
}

// ════════════════════════════════════════════════════════════
// MAIN TASK
// ════════════════════════════════════════════════════════════

export const carouselAgentTask = task({
  id: "carousel-agent",
  maxDuration: 300, // 5 min — 6 images × ~20s each

  run: async (payload: {
    pillar:       ContentPillar;
    platform:     Platform;
    postCount?:   number;
    week?:        number;
    hooks?:       string[];   // from hook bank — one per slot
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

    logger.info(
      `[Carousel] ▶ Starting — pillar: ${pillar} | platform: ${platform} | posts: ${postCount}`
    );

    // ── Step 1: Hooks ─────────────────────────────────────────
    const approvedHooks = await getHooks(pillar, platform, postCount, hooks);

    const results: {
      calendarId:  string;
      hook:        string;
      coverUrl:    string;
      slidesReady: number;
    }[] = [];
    let totalCost = 0;

    for (const hook of approvedHooks) {
      logger.info(`[Carousel] Processing: "${hook.slice(0, 70)}..."`);

      // ── Step 2: Brief ───────────────────────────────────────
      const brief = await buildBrief(hook, pillar, platform);

      // ── Step 3: Images ──────────────────────────────────────
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { localPaths, cost } = await generateImages(brief, jobId);
      totalCost += cost;

      // ── Step 4: Upload to Supabase storage ─────────────────
      const publicUrls = await uploadToStorage(localPaths, jobId);

      // ── Step 5: Save to content_calendar ───────────────────
      const calId = await saveToCalendar(brief, publicUrls, week, triggeredBy);

      // Cleanup tmp files
      try {
        localPaths.forEach(p => p && fs.existsSync(p) && fs.unlinkSync(p));
      } catch { /* non-fatal */ }

      results.push({
        calendarId:  calId,
        hook,
        coverUrl:    publicUrls[0] ?? "",
        slidesReady: publicUrls.filter(Boolean).length,
      });
    }

    logger.info(`[Carousel] ✓ Done — ${results.length} posts saved to content_calendar`);
    logger.info(`[Carousel] Estimated cost: $${totalCost.toFixed(2)}`);

    return {
      success:        true,
      postsGenerated: results.length,
      results,
      estimatedCost:  `$${totalCost.toFixed(2)}`,
      nextStep: [
        "1. Open Content Calendar → filter by 'Instagram Carousel'",
        "2. Review each brief and approve",
        "3. Click 'Queue Social' — cover image auto-sends as image_url to Buffer",
        "4. For TikTok: open drafts, add trending sound, publish",
      ].join(" | "),
    };
  },
});

// ── Helpers ───────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
