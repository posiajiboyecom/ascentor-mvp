// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer — Ambitious Professional Edition
//
// AUDIENCE SEGMENTS:
//   Explorer  (30%) — students, graduates, early jobseekers
//   Builder   (50%) — early-career pros, first-time managers, entrepreneurs
//   Climber   (20%) — mid-career leaders, directors, scaling founders
//
// Each segment gets its own tone, voice, hooks, and CTAs.
// The researcher picks the segment — the writer executes it precisely.
//
// FIXES vs previous version:
//   - Instagram split into 3 separate API calls (carousel / reel / engagement)
//     to prevent token overflow and JSON corruption
//   - Stronger anti-generic examples and specificity rules throughout
//   - Each prompt now shows a BAD example alongside a GOOD example
// ═══════════════════════════════════════════════════════════

import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { type AudiencePreset, type JourneyStage, AUDIENCE_META } from "./content-researcher";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Robust JSON extractor ────────────────────────────────────
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

  const firstBrace = text.indexOf("{"); const firstBracket = text.indexOf("[");
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start !== -1) {
    const closer = text[start] === "{" ? "}" : "]";
    const lastClose = text.lastIndexOf(closer);
    if (lastClose > start) {
      const slice = text.slice(start, lastClose + 1);
      try { return JSON.parse(slice); } catch { /* */ }
      try { return JSON.parse(repairJSON(slice)); } catch { /* */ }
    }
  }

  const arrayStart = text.indexOf("[");
  if (arrayStart !== -1) {
    const lastCompleteClose = (() => {
      let depth = 0; let lastGoodClose = -1;
      for (let i = arrayStart; i < text.length; i++) {
        if (text[i] === "{") depth++;
        if (text[i] === "}") { depth--; if (depth === 0) lastGoodClose = i; }
      }
      return lastGoodClose;
    })();
    if (lastCompleteClose > arrayStart) {
      const truncated = text.slice(0, lastCompleteClose + 1);
      const keyMatch = text.slice(0, arrayStart).match(/"(\w+)"\s*:\s*\[?\s*$/);
      const recovered = keyMatch
        ? `{ "${keyMatch[1]}": [${truncated.slice(truncated.indexOf("[") + 1)}] }`
        : `{ "items": [${truncated.slice(truncated.indexOf("[") + 1)}] }`;
      try { return JSON.parse(recovered); } catch { /* */ }
      try { return JSON.parse(repairJSON(recovered)); } catch { /* */ }
    }
  }
  throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 120)}`);
}

// ── System prompt — JSON enforcement ─────────────────────────
const SYSTEM =
  "You are a JSON API. Respond with ONLY a valid raw JSON object. " +
  "Never use markdown code fences, backticks, or any text before or after the JSON. " +
  "Your entire response must begin with { and end with }. " +
  "CRITICAL JSON RULES: " +
  "(1) All string values must be on ONE logical line — represent newlines as \\n (backslash-n), never as actual line breaks inside strings. " +
  "(2) Never put a raw { or [ character inside a string value — escape it or rephrase. " +
  "(3) Every string must be properly closed with a quote before the next field. " +
  "(4) Never truncate the response — if running long, shorten the content, not the JSON structure.";

// ── ASCENTOR BRAND ────────────────────────────────────────────
const ASCENTOR_BRAND =
  "ABOUT ASCENTOR: We are an AI-powered mentorship and leadership development platform " +
  "built for ambitious professionals worldwide. " +
  "We have worked with thousands of professionals across industries and continents. " +
  "We know what works because we have been in the room — not because we studied it from outside. " +

  "OUR VOICE: Warm. Direct. Authoritative. Deeply human. " +
  "We speak with the confidence of a mentor who has earned it through results. " +
  "NEVER say 'maybe try this', 'you might consider', 'it can be helpful to'. " +
  "SAY: 'here is what we have seen work', 'professionals who do this get promoted 40% faster', 'the data from our sessions is clear'. " +

  "THE GOLDEN RULE OF SPECIFICITY: " +
  "Generic = invisible. Specific = shareable. " +
  "NEVER write: 'career challenges', 'professional growth', 'navigate your career', 'achieve your goals'. " +
  "ALWAYS write the EXACT situation: 'the performance review where you scored top marks and were still passed over', " +
  "'the meeting where you stayed quiet because no one taught you how to command that room', " +
  "'the salary negotiation you lost before it started because you named a number first'. " +
  "If a reader can nod and say 'that is literally me right now' — you have it right. " +
  "If a reader could insert their name into a template — rewrite it.";

// ── Segment-specific CTA framing ─────────────────────────────
const SEGMENT_CTA: Record<string, string> = {
  explorer:
    "CTA FRAMING FOR EXPLORER: Ascentor is the guide they always needed but never had. " +
    "Speak to first steps, clarity, and having someone in your corner. " +
    "STRONG: 'This is exactly what Ascentor Sage is built for — a mentor available at 2am before every big decision. Link in bio.' " +
    "WEAK: 'Ascentor can help you with your career.'",
  builder:
    "CTA FRAMING FOR BUILDER: Ascentor is the edge that closes the gap between effort and recognition. " +
    "STRONG: 'Ascentor members are not waiting to be discovered — they are engineering their visibility. This is the playbook. Join them.' " +
    "WEAK: 'Check out Ascentor for career development.'",
  climber:
    "CTA FRAMING FOR CLIMBER: Ascentor is the strategic thinking partner senior leaders deserve. " +
    "STRONG: 'The leaders making the right moves at this level are not doing it alone. This is the conversation Ascentor is built for.' " +
    "WEAK: 'Ascentor has resources for senior professionals.'",
};

function getSegmentCTA(audience: AudiencePreset): string {
  if (audience === 'explorer') return SEGMENT_CTA.explorer;
  if (audience === 'builder' || audience === 'young_professional') return SEGMENT_CTA.builder;
  if (audience === 'climber' || audience === 'mid_career' || audience === 'executive') return SEGMENT_CTA.climber;
  return SEGMENT_CTA.builder;
}

// ── Segment-specific specificity examples ────────────────────
const SEGMENT_SPECIFICITY: Record<string, string> = {
  explorer:
    "SPECIFICITY EXAMPLES FOR EXPLORER:\n" +
    "GOOD: 'You have three browser tabs open — LinkedIn, a job listing, and your CV — and you have not moved in 40 minutes.'\n" +
    "GOOD: 'Your degree says one thing. Your gut says another. And every adult in your life has a different opinion.'\n" +
    "BAD: 'Starting your career can feel overwhelming and uncertain.'\n" +
    "BAD: 'Many young professionals struggle to find direction.'\n",
  builder:
    "SPECIFICITY EXAMPLES FOR BUILDER:\n" +
    "GOOD: 'You pitched the idea in Monday's meeting. It was ignored. On Friday, your director said it like it was his own. And everyone applauded.'\n" +
    "GOOD: 'The colleague who got promoted has half your output and twice your visibility. You have been doing it backwards.'\n" +
    "BAD: 'Many professionals feel overlooked in their careers.'\n" +
    "BAD: 'Building visibility at work is an important skill for career advancement.'\n",
  climber:
    "SPECIFICITY EXAMPLES FOR CLIMBER:\n" +
    "GOOD: 'You ran the numbers, built the case, and walked into that board meeting ready. They went with someone else's gut feeling.'\n" +
    "GOOD: 'You are the most senior person in the room who still has no one to be honest with.'\n" +
    "BAD: 'Leadership comes with unique challenges at every level.'\n" +
    "BAD: 'Senior professionals often face complex career decisions.'\n",
};

function getSpecificity(audience: AudiencePreset): string {
  if (audience === 'explorer') return SEGMENT_SPECIFICITY.explorer;
  if (audience === 'builder' || audience === 'young_professional') return SEGMENT_SPECIFICITY.builder;
  if (audience === 'climber' || audience === 'mid_career' || audience === 'executive') return SEGMENT_SPECIFICITY.climber;
  return SEGMENT_SPECIFICITY.builder;
}

export const contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 180, // increased — now 7 parallel calls
  run: async (payload: {
    topic: string;
    pillar: "leadership" | "career" | "ai" | "coaching" | "community";
    week?: number;
    triggeredBy?: string;
    briefId?: string | null;
    hooks?: string[];
    instagramHook?: string;
    keyMessages?: string[];
    dataPoints?: string[];
    audience?: AudiencePreset;
    stage?: JourneyStage;
    professionalAngle?: string;
    africanProfessionalAngle?: string;
  }) => {
    const {
      topic, pillar, week = 1,
      hooks = [], instagramHook = "", keyMessages = [], dataPoints = [],
    } = payload;

    const audience: AudiencePreset = payload.stage ?? payload.audience ?? 'builder';
    const professionalAngle = payload.professionalAngle || payload.africanProfessionalAngle || "";
    const audienceMeta = AUDIENCE_META[audience];
    const segmentCTA = getSegmentCTA(audience);
    const specificity = getSpecificity(audience);

    // ── Master voice block ────────────────────────────────────
    const VOICE_BLOCK =
      `${ASCENTOR_BRAND}\n\n` +
      `TARGET SEGMENT: ${audienceMeta.label}\n` +
      `WHO THEY ARE: ${audienceMeta.researchContext.split('.')[0]}.\n\n` +
      `VOICE RULES:\n${audienceMeta.writerVoice}\n\n` +
      `${specificity}\n` +
      (professionalAngle
        ? `CORE TRUTH THIS CONTENT MUST ADDRESS:\n"${professionalAngle}"\n\n`
        : "") +
      `${segmentCTA}\n`;

    const keyMsgBlock = keyMessages.length > 0
      ? `Key messages (weave in naturally — never as a list):\n${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\n` : "";
    const dataBlock = dataPoints.length > 0
      ? `Data points (cite naturally in prose — never as a bullet list):\n${dataPoints.map(d => `- ${d}`).join("\n")}\n\n` : "";
    const hooksBlock = hooks.length >= 3
      ? `Researched hooks:\n- LinkedIn: ${hooks[0]}\n- Twitter/X: ${hooks[1]}\n- Email: ${hooks[2]}\n\n` : "";

    if (payload.briefId) logger.info(`[Writer] briefId: ${payload.briefId}`);
    logger.info(`[Writer] Starting — "${topic}" | ${pillar} | segment: ${audience}`);
    logger.info("[Writer] Firing 7 Claude calls in parallel...");

    // ── 7 parallel calls — Instagram split into 3 ────────────
    const [
      blogSettled,
      linkedinSettled,
      twitterSettled,
      igCarouselSettled,
      igReelSettled,
      igEngagementSettled,
      newsletterSettled,
    ] = await Promise.allSettled([

      // ── 1. BLOG POST ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write a blog post for the Ascentor website.\n\n` +
            `${VOICE_BLOCK}` +
            `TOPIC: "${topic}"\n` +
            `${keyMsgBlock}${dataBlock}` +
            `BLOG REQUIREMENTS:\n` +
            `- 650–800 words. Tight. Every sentence earns its place.\n` +
            `- HEADLINE: Specific, punchy, speaks directly to a ${audienceMeta.label}'s real experience.\n` +
            `  STRONG: "Why the Hardest Workers in the Room Are Still Getting Passed Over for Promotion"\n` +
            `  WEAK: "How to Advance Your Career"\n` +
            `- OPENING PARAGRAPH: Drop into a specific, uncomfortable, recognisable ${audienceMeta.label} moment. Make them feel seen before you give them a single word of advice.\n` +
            `- 3 SUBHEADINGS: Each must feel like a chapter written specifically for the ${audienceMeta.label} stage — not generic career advice.\n` +
            `- EACH SECTION: Lead with the insight, ground it in a scenario, then give the practical application.\n` +
            `- ZERO sentences that could appear in any generic career article. Every point is specific to this stage and this topic.\n` +
            `- ASCENTOR CTA: Close with a confident, specific, single-sentence invitation.\n` +
            `- Represent ALL newlines as \\n in strings.\n\n` +
            `Return ONLY: { "title": "...", "content": "markdown using \\n for line breaks", "meta_description": "under 160 chars — specific and compelling", "cta": "one sentence" }`,
        }],
      }),

      // ── 2. LINKEDIN POSTS ─────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write 3 LinkedIn posts for Ascentor.\n\n` +
            `${VOICE_BLOCK}` +
            `TOPIC: "${topic}"\n` +
            `${hooksBlock}${dataBlock}` +
            `REQUIREMENTS:\n` +
            `- 3 posts: 2 VALUE posts + 1 SOCIAL PROOF post.\n` +
            `- Each post: 150–200 words.\n` +
            `- THE FIRST LINE IS EVERYTHING. Must stop scroll before "...see more".\n` +
            `  STRONG: "Nobody prepares you for the moment a less experienced colleague gets the promotion you worked two years for."\n` +
            `  WEAK: "Career development is important for every professional."\n` +
            `  The first line must name a SPECIFIC, PAINFUL, RECOGNISABLE ${audienceMeta.label} experience.\n` +
            `- VALUE POST: Hook → real insight grounded in ${audienceMeta.label} reality → 3–4 numbered actions (short, concrete, no jargon) → Ascentor CTA.\n` +
            `- SOCIAL PROOF POST: Open with a real result → the struggle → what changed → confident invite.\n` +
            `- Max 5 emojis per post. ZERO hashtags inside the post body — list them separately.\n` +
            `- Represent newlines as \\n in all string values.\n\n` +
            `Return ONLY: { "posts": [ { "type": "value|social_proof", "hook": "first line only", "content": "full post with \\n breaks", "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", "#Ascentor"] } ] }`,
        }],
      }),

      // ── 3. TWITTER/X THREADS ──────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write 2 Twitter/X threads for Ascentor.\n\n` +
            `${VOICE_BLOCK}` +
            `TOPIC: "${topic}"\n` +
            `${hooksBlock}` +
            `REQUIREMENTS:\n` +
            `- 2 threads, 5–6 tweets each. Max 280 characters per tweet (count carefully).\n` +
            `- Thread 1: VALUE — practical insight grounded in ${audienceMeta.label} reality.\n` +
            `- Thread 2: STORY — a scenario any ${audienceMeta.label} immediately recognises, ending in a lesson.\n` +
            `- TWEET 1 (OPENER): Must feel like a direct call-out in the best possible way.\n` +
            `  STRONG: "The most talented person in the room is often the last to get promoted. Here is the specific reason why 🧵"\n` +
            `  WEAK: "Here are some career tips every professional needs to know 🧵"\n` +
            `- Each tweet: ONE idea. Short sentences. No padding. Written like a mentor sending you a message.\n` +
            `- Tweet 4 or 5: The insight that makes them want to screenshot and share immediately.\n` +
            `- Final tweet: Natural, non-salesy Ascentor mention.\n` +
            `- Max 2 emojis per tweet. ZERO region-specific language.\n\n` +
            `Return ONLY: { "threads": [ { "theme": "value|story", "opener": "tweet 1 text", "tweets": ["t1","t2","t3","t4","t5"], "cta": "final tweet text" } ] }`,
        }],
      }),

      // ── 4. INSTAGRAM CAROUSEL ────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write ONE Instagram Carousel post for Ascentor.\n\n` +
            `${VOICE_BLOCK}` +
            `TOPIC: "${topic}"\n` +
            `${instagramHook ? `Research hook: ${instagramHook}\n\n` : ""}` +
            `REQUIREMENTS:\n` +
            `- CAPTION: 100–130 words.\n` +
            `  Open with ONE sentence that makes a ${audienceMeta.label} immediately stop scrolling.\n` +
            `  STRONG: "The thing nobody tells you before your first big performance review — and the exact reason it blindsides most people."\n` +
            `  WEAK: "Here is some important advice for professionals at any stage."\n` +
            `  End with: "Save this — you will need it."\n` +
            `- SLIDES: Exactly 6 slides. Each slide: ONE punchy statement, max 12 words.\n` +
            `  Slide 1: The hook — what this carousel is about.\n` +
            `  Slides 2–5: A bold, specific truth about life at the ${audienceMeta.label} stage.\n` +
            `  Slide 6: "This is exactly what Ascentor is built for. Link in bio."\n` +
            `- Represent ALL newlines as \\n in string values.\n\n` +
            `Return ONLY: { "type": "carousel", "caption": "caption text with \\n breaks", "slides": ["slide 1 text", "slide 2 text", "slide 3 text", "slide 4 text", "slide 5 text", "slide 6 text"], "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", "#Ascentor", "#${audienceMeta.label.replace(/\s+/g, '')}"] }`,
        }],
      }),

      // ── 5. INSTAGRAM REEL SCRIPT ─────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write ONE Instagram Reel script for Ascentor.\n\n` +
            `${VOICE_BLOCK}` +
            `TOPIC: "${topic}"\n\n` +
            `REQUIREMENTS:\n` +
            `- CAPTION: 80–100 words. Punchy, conversational, directly written for a ${audienceMeta.label}.\n` +
            `  Opens with a one-line hook that makes them tap. ZERO corporate language.\n` +
            `- SCRIPT: 60–90 second spoken word. Fast-paced. Short sentences. Written exactly as someone would say it.\n` +
            `  Include [visual cue] markers like [look at camera], [text on screen: "..."], [cut to B-roll].\n` +
            `  Open strong: name a specific ${audienceMeta.label} experience in the first 5 seconds.\n` +
            `  Close with a natural Ascentor mention that feels like a recommendation from a friend.\n` +
            `- Represent ALL newlines as \\n in string values.\n\n` +
            `Return ONLY: { "type": "reel", "caption": "caption text with \\n breaks", "script": "full script with \\n breaks and [visual cues]", "slides": null, "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", "#Ascentor"] }`,
        }],
      }),

      // ── 6. INSTAGRAM ENGAGEMENT POST ─────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write ONE Instagram Engagement post for Ascentor.\n\n` +
            `TARGET SEGMENT: ${audienceMeta.label}\n` +
            `TOPIC: "${topic}"\n\n` +
            `REQUIREMENTS:\n` +
            `- A question post designed to get ${audienceMeta.label}s talking in the comments.\n` +
            `- The question must be specific enough that they feel personally called out.\n` +
            `  STRONG: "What is the one thing you wish someone had told you before your first salary negotiation? Drop it below — someone reading this needs it."\n` +
            `  WEAK: "What do you think about career development? Let us know!"\n` +
            `  STRONG: "The moment you realised the job you thought you wanted was not actually the job you wanted — what happened next?"\n` +
            `  WEAK: "Have you ever faced challenges in your career journey?"\n` +
            `- CAPTION: 70–90 words. Set the question up in 2–3 sentences, then ask it. Max 2 emojis. ZERO corporate tone.\n` +
            `- Represent ALL newlines as \\n in string values.\n\n` +
            `Return ONLY: { "type": "engagement", "caption": "caption text with \\n breaks", "slides": null, "script": null, "hashtags": ["#AmbitiousProfessionals", "#CareerCommunity", "#Ascentor", "#${audienceMeta.label.replace(/\s+/g, '')}"] }`,
        }],
      }),

      // ── 7. NEWSLETTER ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1600,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Write the weekly "The Ascentor Edge" newsletter.\n\n` +
            `${VOICE_BLOCK}` +
            `TOPIC: "${topic}"\n` +
            `${dataBlock}` +
            `${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}\n\n` : ""}` +
            `REQUIREMENTS:\n` +
            `- 450–550 words. Not a corporate newsletter. A personal letter from the most insightful mentor this ${audienceMeta.label} has ever had.\n\n` +
            `SUBJECT LINE:\n` +
            `  Personal, specific, slightly uncomfortable in the best way — written for a ${audienceMeta.label}.\n` +
            `  STRONG: "The meeting they had about your promotion — without you in the room"\n` +
            `  STRONG: "You passed the technical round. Here is why you still did not get the job."\n` +
            `  WEAK: "This week's career tips from Ascentor"\n` +
            `  WEAK: "Professional development advice for ambitious people"\n\n` +
            `STRUCTURE:\n` +
            `1. HOOK (2–3 sentences): A specific, recognisable ${audienceMeta.label} moment. So accurate they forward the email.\n` +
            `2. THE REAL TALK (150–200 words): The core insight. Be specific — name the exact situation, not the category.\n` +
            `3. WHAT WE HAVE SEEN (80–100 words): One pattern from Ascentor coaching sessions.\n` +
            `   Use: "In our sessions recently, we keep seeing..." — this is Ascentor's authority.\n` +
            `4. YOUR MOVE THIS WEEK (80–100 words): ONE specific, doable action. Not a list. One move. Make it concrete.\n` +
            `5. SIGN-OFF: Warm. Human. Not corporate. One natural Ascentor mention — invitation, not pitch.\n` +
            `- Represent ALL newlines as \\n in string values.\n\n` +
            `Return ONLY: { "subject": "...", "preview_text": "under 90 chars", "body": "markdown with \\n breaks" }`,
        }],
      }),
    ]);

    // ── Extract results with fallbacks ───────────────────────
    let blog: any = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        logger.info(`[Writer] Blog raw (first 300): ${raw.slice(0, 300)}`);
        blog = extractJSON(raw);
        logger.info(`[Writer] Blog ok — "${blog.title}"`);
      } catch (e) { logger.error(`[Writer] Blog parse failed: ${e}`); }
    } else { logger.error(`[Writer] Blog API error: ${blogSettled.reason}`); }

    let linkedinPosts: any[] = [];
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        linkedinPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Writer] LinkedIn ok — ${linkedinPosts.length} posts`);
      } catch (e) { logger.error(`[Writer] LinkedIn parse failed: ${e}`); }
    } else { logger.error(`[Writer] LinkedIn API error: ${linkedinSettled.reason}`); }

    let twitterThreads: any[] = [];
    if (twitterSettled.status === "fulfilled") {
      try {
        const raw = twitterSettled.value.content[0].type === "text" ? twitterSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        twitterThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
        logger.info(`[Writer] Twitter ok — ${twitterThreads.length} threads`);
      } catch (e) { logger.error(`[Writer] Twitter parse failed: ${e}`); }
    } else { logger.error(`[Writer] Twitter API error: ${twitterSettled.reason}`); }

    // Instagram: collect 3 separate results into one array
    const instagramPosts: any[] = [];
    for (const [label, settled] of [
      ["IG Carousel", igCarouselSettled],
      ["IG Reel",     igReelSettled],
      ["IG Engagement", igEngagementSettled],
    ] as [string, PromiseSettledResult<any>][]) {
      if (settled.status === "fulfilled") {
        try {
          const raw = settled.value.content[0].type === "text" ? settled.value.content[0].text : "";
          const parsed = extractJSON(raw);
          instagramPosts.push(parsed);
          logger.info(`[Writer] ${label} ok — type: ${parsed.type}`);
        } catch (e) { logger.error(`[Writer] ${label} parse failed: ${e}`); }
      } else { logger.error(`[Writer] ${label} API error: ${(settled as PromiseRejectedResult).reason}`); }
    }

    let newsletter: any = { subject: `The Ascentor Edge: ${topic}`, preview_text: "", body: "" };
    if (newsletterSettled.status === "fulfilled") {
      try {
        const raw = newsletterSettled.value.content[0].type === "text" ? newsletterSettled.value.content[0].text : "";
        newsletter = extractJSON(raw);
        logger.info(`[Writer] Newsletter ok — "${newsletter.subject}"`);
      } catch (e) { logger.error(`[Writer] Newsletter parse failed: ${e}`); }
    } else { logger.error(`[Writer] Newsletter API error: ${newsletterSettled.reason}`); }

    // ── Build content calendar rows ──────────────────────────
    const items = [
      { pillar, week, status: "draft", platform: "Website", type: "Blog Post", audience,
        title: (blog.title || topic).substring(0, 255), content_data: blog },
      ...linkedinPosts.map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "LinkedIn", type: "LinkedIn Post", audience,
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`, content_data: p })),
      ...twitterThreads.map((t: any, i: number) => ({
        pillar, week, status: "draft", platform: "Twitter/X", type: "Twitter Thread", audience,
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`, content_data: t })),
      ...instagramPosts.map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "Instagram",
        type: `Instagram ${(p.type || "post").charAt(0).toUpperCase() + (p.type || "post").slice(1)}`,
        audience,
        title: `IG ${p.type || "post"}: ${(p.caption || `Instagram ${i + 1}`).replace(/\\n/g, ' ').substring(0, 55)}...`,
        content_data: p })),
      { pillar, week, status: "draft", platform: "Email", type: "Email Newsletter", audience,
        title: (newsletter.subject || `The Ascentor Edge: ${topic}`).substring(0, 255), content_data: newsletter },
    ];

    // ── Insert to Supabase ────────────────────────────────────
    let insertedCount = 0;
    for (const item of items) {
      const { error } = await supabase.from("content_calendar").insert(item);
      if (error) logger.error(`[Writer] Insert failed "${item.title}": ${JSON.stringify(error)}`);
      else insertedCount++;
    }

    logger.info(`[Writer] Saved ${insertedCount}/${items.length} rows to content_calendar`);

    const summary = {
      topic, pillar, week, audience, professionalAngle,
      generated: {
        blog: 1,
        linkedin_posts: linkedinPosts.length,
        twitter_threads: twitterThreads.length,
        instagram_carousel: instagramPosts.filter(p => p.type === "carousel").length,
        instagram_reel: instagramPosts.filter(p => p.type === "reel").length,
        instagram_engagement: instagramPosts.filter(p => p.type === "engagement").length,
        newsletter: 1,
      },
      total_items: items.length,
      inserted: insertedCount,
    };

    logger.info("[Writer] Done:", summary);
    return summary;
  },
});
