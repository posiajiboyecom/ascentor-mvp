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
  "Never use markdown code fences. Never add text before or after the JSON. " +
  "Your response must begin with { and end with }. " +
  "CRITICAL: Inside JSON string values, represent newlines as the two characters \\n (backslash + n), " +
  "never as actual line breaks. All string values must be on one line.";

// ── ASCENTOR BRAND ────────────────────────────────────────────
const ASCENTOR_BRAND =
  "ABOUT ASCENTOR: We are an AI-powered mentorship and leadership development platform " +
  "built for ambitious professionals worldwide. " +
  "We have worked with thousands of professionals across industries and continents — " +
  "we have seen the promotions, the plateaus, and the breakthroughs. " +
  "We know what works because we have been in the room, not because we studied it from outside. " +

  "OUR VOICE: Warm. Direct. Authoritative. Deeply human. " +
  "We speak with the confidence of a mentor who has earned it through results — not the confidence of a brand running ads. " +
  "We NEVER say 'maybe try this' or 'you might consider'. " +
  "We say 'here is what we have seen work', 'professionals who do this get promoted 40% faster', " +
  "'the data from our sessions is clear'. " +

  "OUR PROMISE TO READERS: We see you. We understand what it actually feels like " +
  "to be talented, ambitious, and stuck in an environment that is not built to help you grow. " +
  "We are the mentor most professionals never had — and we are accessible. " +

  "CONTENT MISSION: Every piece of content must do three things: " +
  "1. Make the reader feel deeply understood and seen. " +
  "2. Give them a genuine insight they can use immediately. " +
  "3. Show them, confidently and specifically, that Ascentor is the platform that closes their gap.";

// ── Segment-specific CTA framing ─────────────────────────────
const SEGMENT_CTA: Record<string, string> = {
  explorer:
    "CTA FRAMING: Ascentor is the guide they always needed but never had. " +
    "Speak to first steps, clarity, and direction. " +
    "STRONG: 'Sage walks you through this step by step — like having a mentor on call before every big decision.' " +
    "WEAK: 'Ascentor can help you with your career.'",
  builder:
    "CTA FRAMING: Ascentor is the edge that closes the gap between effort and recognition. " +
    "Speak to speed, results, and momentum. " +
    "STRONG: 'This is exactly what Ascentor was built for. Our members are not waiting to be discovered — they are learning to engineer their visibility. Join them.' " +
    "WEAK: 'Ascentor might be able to help you with this.'",
  climber:
    "CTA FRAMING: Ascentor is the strategic thinking partner senior leaders deserve. " +
    "Speak to precision, leverage, and legacy. " +
    "STRONG: 'This is the conversation Ascentor is built for. The leaders making the right moves at this level are not doing it alone.' " +
    "WEAK: 'Ascentor has resources for senior professionals.'",
};

function getSegmentCTA(audience: AudiencePreset): string {
  if (audience === 'explorer') return SEGMENT_CTA.explorer;
  if (audience === 'builder' || audience === 'young_professional') return SEGMENT_CTA.builder;
  if (audience === 'climber' || audience === 'mid_career' || audience === 'executive') return SEGMENT_CTA.climber;
  return SEGMENT_CTA.builder; // default
}

export const contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 120,
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
    stage?: JourneyStage;          // convenience shorthand
    professionalAngle?: string;
    africanProfessionalAngle?: string; // legacy alias
  }) => {
    const {
      topic, pillar, week = 1,
      hooks = [], instagramHook = "", keyMessages = [], dataPoints = [],
    } = payload;

    // stage shorthand takes precedence if provided
    const audience: AudiencePreset = payload.stage ?? payload.audience ?? 'builder';
    const professionalAngle = payload.professionalAngle || payload.africanProfessionalAngle || "";
    const audienceMeta = AUDIENCE_META[audience];
    const segmentCTA = getSegmentCTA(audience);

    // ── Master voice block — injected into EVERY prompt ──────
    const VOICE_BLOCK =
      `${ASCENTOR_BRAND}\n\n` +
      `TARGET SEGMENT: ${audienceMeta.label} — ${audienceMeta.researchContext.split('.')[0]}.\n` +
      `WRITING VOICE RULES:\n${audienceMeta.writerVoice}\n` +
      (professionalAngle
        ? `\nCORE TRUTH TO ADDRESS IN THIS CONTENT:\n"${professionalAngle}"\n`
        : "") +
      `\n${segmentCTA}\n` +
      `\nCRITICAL LANGUAGE RULES:\n` +
      `- ZERO region-specific slang or cultural references that would alienate any reader\n` +
      `- Write for the ${audienceMeta.label} experience — every reader in this segment should say "this is me"\n` +
      `- Ascentor's confidence is earned from results — use that authority in every sentence\n` +
      `- When mentioning Ascentor, show impact: "Ascentor members", "in our coaching sessions", ` +
      `"professionals who work with Ascentor" — not just "Ascentor can help"\n`;

    const keyMsgBlock = keyMessages.length > 0
      ? `\nKey messages to weave in naturally:\n${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n` : "";
    const dataBlock = dataPoints.length > 0
      ? `\nData points to use (cite naturally, not as a list):\n${dataPoints.map(d => `- ${d}`).join("\n")}\n` : "";
    const hooksBlock = hooks.length >= 3
      ? `\nResearched platform hooks:\n- LinkedIn: ${hooks[0]}\n- Twitter/X: ${hooks[1]}\n- Email: ${hooks[2]}\n` : "";

    if (payload.briefId) logger.info(`[Writer] briefId: ${payload.briefId}`);
    logger.info(`[Writer] Starting — "${topic}" | ${pillar} | segment: ${audience}`);
    logger.info("[Writer] Firing 5 Claude calls in parallel (blog, linkedin, twitter, instagram, newsletter)...");

    const [blogSettled, linkedinSettled, twitterSettled, instagramSettled, newsletterSettled] =
      await Promise.allSettled([

        // ── 1. BLOG POST ─────────────────────────────────────
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: SYSTEM,
          messages: [{
            role: "user",
            content:
              `Write a blog post for the Ascentor website.\n\n` +
              `${VOICE_BLOCK}\n` +
              `TOPIC: "${topic}"\n` +
              `${keyMsgBlock}${dataBlock}\n` +
              `BLOG REQUIREMENTS:\n` +
              `- 650–800 words. Tight and purposeful — your readers are busy, respect that.\n` +
              `- HEADLINE: Specific, punchy, and directly relevant to a ${audienceMeta.label}'s real experience.\n` +
              `  STRONG: "Why the Hardest Workers in the Room Are Still Getting Passed Over for Promotion"\n` +
              `  WEAK: "How to Advance Your Career at Work"\n` +
              `- OPENING PARAGRAPH: Drop the reader into a specific, recognisable moment for a ${audienceMeta.label}. Make them feel seen before you say a word of advice.\n` +
              `- 3 SUBHEADINGS: Each one should feel like a chapter in a book written specifically for their stage.\n` +
              `- EACH SECTION: Lead with the insight, ground it in a scenario a ${audienceMeta.label} would immediately recognise, then give the practical application.\n` +
              `- ZERO generic advice. Every point must feel written for someone at the ${audienceMeta.label} stage.\n` +
              `- ASCENTOR CTA: Close with a confident, specific invitation to Ascentor.\n` +
              `- SEO: naturally include terms like "career development", "${audienceMeta.label.toLowerCase()} career", the pillar topic.\n` +
              `- Use \\n for line breaks.\n\n` +
              `Return: { "title": "...", "content": "markdown with \\n line breaks", "meta_description": "under 160 chars — specific and compelling", "cta": "..." }`,
          }],
        }),

        // ── 2. LINKEDIN POSTS ─────────────────────────────────
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 3000,
          system: SYSTEM,
          messages: [{
            role: "user",
            content:
              `Write 3 LinkedIn posts for Ascentor.\n\n` +
              `${VOICE_BLOCK}\n` +
              `TOPIC: "${topic}"\n` +
              `${hooksBlock}${dataBlock}\n` +
              `LINKEDIN REQUIREMENTS:\n` +
              `- 3 posts total: 2 VALUE posts, 1 SOCIAL PROOF/ASCENTOR IMPACT post.\n` +
              `- Each post: 150–200 words.\n` +
              `- THE OPENING LINE IS EVERYTHING.\n` +
              `  It must stop the scroll BEFORE "...see more". It must name a specific, painful, recognisable ${audienceMeta.label} experience.\n` +
              `  STRONG: "Nobody prepares you for the moment a less experienced colleague gets the promotion you worked two years for. Not HR. Not your manager. Nobody."\n` +
              `  WEAK: "Career development is crucial for professionals at every stage."\n` +
              `- VALUE POST STRUCTURE: Hook → The real insight (grounded in ${audienceMeta.label} reality) → 3–5 concrete actions → Ascentor CTA.\n` +
              `- SOCIAL PROOF POST: Open with a real result → what the ${audienceMeta.label} was struggling with → what changed → confident invitation.\n` +
              `- Max 5 relevant emojis per post.\n` +
              `- Use \\n for line breaks.\n\n` +
              `Return: { "posts": [ { "type": "value|social_proof", "hook": "opening line only", "content": "full post with \\n breaks", "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", ...] } ] }`,
          }],
        }),

        // ── 3. TWITTER/X THREADS ──────────────────────────────
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: SYSTEM,
          messages: [{
            role: "user",
            content:
              `Write 2 Twitter/X threads for Ascentor.\n\n` +
              `${VOICE_BLOCK}\n` +
              `TOPIC: "${topic}"\n` +
              `${hooksBlock}\n` +
              `TWITTER/X REQUIREMENTS:\n` +
              `- 2 threads, 5–6 tweets each. Under 280 characters per tweet.\n` +
              `- Thread 1: VALUE — practical insight, grounded in ${audienceMeta.label} reality.\n` +
              `- Thread 2: STORY — a scenario any ${audienceMeta.label} recognises immediately, with a clear lesson.\n` +
              `- TWEET 1 (OPENER): Must make a ${audienceMeta.label} stop mid-scroll and feel called out in the best way.\n` +
              `  STRONG: "The most talented professional in the room is often the last one to get promoted. Here is why 🧵"\n` +
              `  WEAK: "Here are some career tips every professional should know 🧵"\n` +
              `- Each tweet: ONE clear, specific idea. Short sentences. Like a message from a mentor.\n` +
              `- Tweet 5: The insight that makes them want to save and share immediately.\n` +
              `- Final tweet: Natural mention of Ascentor — not an ad, a genuine invite.\n` +
              `- Max 2 emojis per tweet. ZERO region-specific slang.\n\n` +
              `Return: { "threads": [ { "opener": "tweet 1", "tweets": ["t1","t2","t3","t4","t5"], "cta": "final tweet", "theme": "value|story" } ] }`,
          }],
        }),

        // ── 4. INSTAGRAM ─────────────────────────────────────
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1800,
          system: SYSTEM,
          messages: [{
            role: "user",
            content:
              `Write 3 Instagram posts for Ascentor.\n\n` +
              `${VOICE_BLOCK}\n` +
              `TOPIC: "${topic}"\n` +
              `${instagramHook ? `Opening hook from research: ${instagramHook}\n\n` : ""}` +
              `${dataBlock}\n` +
              `INSTAGRAM REQUIREMENTS:\n` +
              `- 3 posts: 1 CAROUSEL, 1 REEL SCRIPT, 1 ENGAGEMENT post.\n\n` +
              `CAROUSEL POST:\n` +
              `  Caption: 100–150 words. Open with a single sentence that makes a ${audienceMeta.label} immediately tap to read more.\n` +
              `  End caption with: "Save this post — you will need it."\n` +
              `  Slides (5–7 slides): Each slide is ONE punchy statement. Max 15 words per slide.\n` +
              `  Slide 1: The hook — what the whole carousel is about.\n` +
              `  Each slide: A bold, specific truth about life at the ${audienceMeta.label} stage.\n` +
              `  Last slide: "This is exactly what Ascentor helps you master. Link in bio."\n\n` +
              `REEL SCRIPT:\n` +
              `  60–90 second script. Fast-paced, conversational, direct.\n` +
              `  Written as spoken word — short punchy sentences as a ${audienceMeta.label} would actually say them.\n` +
              `  Include [visual cue] markers.\n` +
              `  End with a confident Ascentor mention that feels like a recommendation, not an ad.\n\n` +
              `ENGAGEMENT POST:\n` +
              `  A question that ${audienceMeta.label}s will actually want to answer in the comments.\n` +
              `  STRONG: "What is the one thing you wish someone had told you before your first performance review?"\n` +
              `  WEAK: "What do you think about career development?"\n` +
              `  80–100 words caption. Max 2 emojis.\n\n` +
              `- Hashtag strategy: mix high-reach (#AmbitiousProfessionals, #CareerGrowth, #Ascentor) with niche relevant tags.\n` +
              `- Use \\n for line breaks.\n\n` +
              `Return: { "posts": [ { "type": "carousel|reel|engagement", "caption": "...", "slides": ["slide 1",...] or null, "script": "..." or null, "hashtags": [...] } ] }`,
          }],
        }),

        // ── 5. NEWSLETTER ─────────────────────────────────────
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1400,
          system: SYSTEM,
          messages: [{
            role: "user",
            content:
              `Write the weekly "The Ascentor Edge" newsletter.\n\n` +
              `${VOICE_BLOCK}\n` +
              `TOPIC: "${topic}"\n` +
              `${dataBlock}` +
              `${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}\n` : ""}\n` +
              `NEWSLETTER REQUIREMENTS:\n` +
              `- 450–550 words. Every paragraph must earn its place.\n` +
              `- THIS IS NOT A CORPORATE NEWSLETTER. It is a personal letter from the most insightful mentor this ${audienceMeta.label} has ever had.\n` +
              `  It should feel like a message from someone who actually knows where they are in their journey right now.\n\n` +
              `SUBJECT LINE:\n` +
              `  Must feel personal, specific, and slightly uncomfortable in the best way — written for a ${audienceMeta.label}.\n` +
              `  STRONG: "The meeting they had about your promotion — without you in the room"\n` +
              `  WEAK: "This week's career growth tips from Ascentor"\n\n` +
              `STRUCTURE:\n` +
              `1. HOOK (2–3 sentences): Drop them into a specific, recognisable ${audienceMeta.label} moment. Make them feel so seen they forward the email.\n` +
              `2. THE REAL TALK (150–200 words): The core insight. Address what is actually happening for ${audienceMeta.label}s right now. Be specific. No platitudes.\n` +
              `3. WHAT WE HAVE SEEN (80–100 words): One pattern from Ascentor's coaching work.\n` +
              `   "In our sessions this week, we keep seeing..." — this is where Ascentor's authority shows.\n` +
              `4. YOUR MOVE THIS WEEK (80–100 words): ONE specific, doable action for a ${audienceMeta.label}. Not a list. One move.\n` +
              `5. SIGN-OFF: Warm. Human. Not corporate. One natural mention of Ascentor — an invitation, not a sales pitch.\n\n` +
              `- Use \\n for line breaks.\n\n` +
              `Return: { "subject": "...", "preview_text": "under 90 chars", "body": "markdown with \\n breaks" }`,
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

    let instagramPosts: any[] = [];
    if (instagramSettled.status === "fulfilled") {
      try {
        const raw = instagramSettled.value.content[0].type === "text" ? instagramSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        instagramPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Writer] Instagram ok — ${instagramPosts.length} posts`);
      } catch (e) { logger.error(`[Writer] Instagram parse failed: ${e}`); }
    } else { logger.error(`[Writer] Instagram API error: ${instagramSettled.reason}`); }

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
        pillar, week, status: "draft", platform: "Instagram", type: `Instagram ${p.type || "Post"}`, audience,
        title: `IG: ${(p.caption || `Instagram ${i + 1}`).substring(0, 60)}...`, content_data: p })),
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
        blog: 1, linkedin_posts: linkedinPosts.length,
        twitter_threads: twitterThreads.length,
        instagram_posts: instagramPosts.length, newsletter: 1,
      },
      total_items: items.length, inserted: insertedCount,
    };

    logger.info("[Writer] Done:", summary);
    return summary;
  },
});
