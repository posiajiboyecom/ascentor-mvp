// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer — African Young Professional Edition
//
// WHAT CHANGED FROM NIGERIA-FIRST VERSION:
//   - All prompts now write from a pan-African insider perspective
//   - Zero Nigeria-specific slang — universally relatable across Africa
//   - Young professional (21–28) is the hero of every piece
//   - Ascentor's VALUE and IMPACT is the North Star of every post
//   - Every platform prompt demands Ascentor's confidence framing
//   - Relatability rule: if a young pro reads it and doesn't say
//     "this is me", the post failed
//   - Instagram fully integrated as a first-class platform
//   - Blog SEO targets pan-African career search terms
//   - Newsletter reads as a letter from a brilliant mentor,
//     not a corporate email blast
// ═══════════════════════════════════════════════════════════

import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { type AudiencePreset, AUDIENCE_META } from "./content-researcher";

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

// ── ASCENTOR BRAND — injected into every single prompt ───────
// This is the non-negotiable identity of every piece of content.
const ASCENTOR_BRAND =
  "ABOUT ASCENTOR: We are an AI-powered mentorship and leadership development platform " +
  "built specifically for African professionals. " +
  "We have worked with thousands of professionals across the continent — " +
  "we have seen the promotions, the plateaus, and the breakthroughs. " +
  "We know what works because we have been in the room, not because we studied it from outside. " +

  "OUR VOICE: Warm. Direct. Authoritative. Deeply human. " +
  "We speak with the confidence of a mentor who has earned it through results — not the confidence of a brand running ads. " +
  "We NEVER say 'maybe try this' or 'you might consider'. " +
  "We say 'here is what we have seen work', 'professionals who do this get promoted 40% faster', " +
  "'the data from our sessions is clear'. " +

  "OUR PROMISE TO READERS: We see you. We understand what it actually feels like " +
  "to be talented, ambitious, and stuck in an environment that is not built to help you grow. " +
  "We are the mentor most African professionals never had — and we are accessible. " +

  "CONTENT MISSION: Every piece of content must do three things: " +
  "1. Make the reader feel deeply understood and seen. " +
  "2. Give them a genuine insight they can use immediately. " +
  "3. Show them, confidently and specifically, that Ascentor is the platform that closes their gap.";

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
    africanProfessionalAngle?: string;
  }) => {
    const {
      topic, pillar, week = 1,
      hooks = [], instagramHook = "", keyMessages = [], dataPoints = [],
      audience = 'young_professional',
      africanProfessionalAngle = "",
    } = payload;

    const audienceMeta = AUDIENCE_META[audience];

    // ── Master voice block — injected into EVERY prompt ──────
    // This ensures brand consistency across all 5 platforms.
    const VOICE_BLOCK =
      `${ASCENTOR_BRAND}\n\n` +
      `TARGET AUDIENCE: ${audienceMeta.label} — ${audienceMeta.ageRange} year olds.\n` +
      `WRITING VOICE RULES:\n${audienceMeta.writerVoice}\n` +
      (africanProfessionalAngle
        ? `\nCORE AFRICAN PROFESSIONAL TRUTH TO ADDRESS IN THIS CONTENT:\n"${africanProfessionalAngle}"\n`
        : "") +
      `\nCRITICAL LANGUAGE RULES FOR ALL CONTENT:\n` +
      `- ZERO country-specific slang (no "oga", "sharp sharp", "japa", "NYSC" etc.)\n` +
      `- Write for a pan-African professional audience — relatable Lagos to Nairobi to Johannesburg\n` +
      `- Speak to UNIVERSAL African career experiences — every reader should say "this is me"\n` +
      `- Ascentor's confidence is earned from results — use that authority in every sentence\n` +
      `- When mentioning Ascentor, show impact: "Ascentor members", "in our coaching sessions", ` +
      `"professionals who work with Ascentor" — not just "Ascentor can help"\n`;

    const keyMsgBlock = keyMessages.length > 0
      ? `\nKey messages to weave into the content naturally:\n${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n` : "";
    const dataBlock = dataPoints.length > 0
      ? `\nData points to use (cite them naturally, not as a list):\n${dataPoints.map(d => `- ${d}`).join("\n")}\n` : "";
    const hooksBlock = hooks.length >= 3
      ? `\nResearched platform hooks:\n- LinkedIn: ${hooks[0]}\n- Twitter/X: ${hooks[1]}\n- Email: ${hooks[2]}\n` : "";

    if (payload.briefId) logger.info(`[Writer] briefId: ${payload.briefId}`);
    logger.info(`[Writer] Starting — "${topic}" | ${pillar} | audience: ${audience}`);
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
              `- 650–800 words. Tight and purposeful — African professionals are busy, respect that.\n` +
              `- HEADLINE: Specific, punchy, and directly relevant to an African young professional's real experience.\n` +
              `  STRONG: "Why the Hardest Workers in the Room Are Still Getting Passed Over for Promotion"\n` +
              `  WEAK: "How to Advance Your Career at Work"\n` +
              `- OPENING PARAGRAPH: Drop the reader into a specific, recognisable moment. Make them feel seen before you say a word of advice.\n` +
              `  Example: "It is a Tuesday afternoon. You just sat through a meeting where the idea you shared three weeks ago was presented as new — by someone else. You smiled and said nothing. If that has happened to you, this post is written for you."\n` +
              `- 3 SUBHEADINGS: Each one should feel like a chapter in a book about their career life.\n` +
              `- EACH SECTION: Lead with the insight, ground it in a specific African professional scenario, then give the practical application.\n` +
              `- ZERO generic advice. Every point must feel written for someone building their career in an African city.\n` +
              `- ASCENTOR CTA: Close with a confident, specific invitation to Ascentor.\n` +
              `  STRONG: "This is exactly what Ascentor was built for. Our members are not waiting to be discovered — they are learning to engineer their visibility. Join them."\n` +
              `  WEAK: "Ascentor might be able to help you with this."\n` +
              `- SEO: naturally include terms like "career growth Africa", "African professional development", the pillar topic.\n` +
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
              `  It must stop the scroll BEFORE "...see more". It must name a specific, painful, recognisable African young professional experience.\n` +
              `  STRONG: "Nobody prepares you for the moment a less experienced colleague gets the promotion you worked two years for. Not HR. Not your manager. Nobody."\n` +
              `  WEAK: "Career development is crucial for professionals at every stage."\n` +
              `- VALUE POST STRUCTURE: Hook → The real insight (grounded in African professional reality) → 3–5 concrete actions → Ascentor CTA.\n` +
              `- SOCIAL PROOF POST STRUCTURE: Open with a real result we have seen → what the professional was struggling with → what changed → confident invitation to join.\n` +
              `  Frame as: "In our coaching sessions, we keep seeing this..." or "The professionals who break through do this one thing differently..."\n` +
              `- ASCENTOR CONFIDENCE: Use results-based framing. "Ascentor members who do this are promoted 40% faster" not "Ascentor can help you grow".\n` +
              `- Max 5 relevant emojis per post.\n` +
              `- Use \\n for line breaks.\n\n` +
              `Return: { "posts": [ { "type": "value|social_proof", "hook": "opening line only", "content": "full post with \\n breaks", "hashtags": ["#AfricanProfessionals", "#CareerGrowth", ...] } ] }`,
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
              `- Thread 1: VALUE — practical insight, grounded in African professional reality.\n` +
              `- Thread 2: STORY — a scenario African young professionals recognise immediately, with a clear lesson.\n` +
              `- TWEET 1 (OPENER): This is the most important sentence you will write. It must make someone stop mid-scroll and feel called out in the best way.\n` +
              `  STRONG: "The most talented professional in the room is often the last one to get promoted. Here is why — and what actually changes it 🧵"\n` +
              `  WEAK: "Here are some career tips every professional should know 🧵"\n` +
              `- Each tweet: ONE clear, specific idea. Short sentences. Like a message from a mentor.\n` +
              `- Tweet 5: The insight that makes them want to save and share immediately.\n` +
              `- Final tweet: Natural mention of Ascentor — not an ad, a genuine invite from someone who knows what they are talking about.\n` +
              `- Max 2 emojis per tweet.\n` +
              `- ZERO country-specific slang.\n\n` +
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
              `- 3 posts: 1 CAROUSEL (swipeable list), 1 REEL SCRIPT, 1 ENGAGEMENT post.\n\n` +
              `CAROUSEL POST:\n` +
              `  Caption: 100–150 words. Open with a single sentence that makes a young African professional immediately tap to read more.\n` +
              `  End caption with: "Save this post — you will need it."\n` +
              `  Slides (5–7 slides): Each slide is ONE punchy statement. Max 15 words per slide.\n` +
              `  Slide 1: The hook — what the whole carousel is about. Make them swipe.\n` +
              `    STRONG Slide 1: "What your organisation is not telling you about how promotions actually work"\n` +
              `    WEAK Slide 1: "Career tips for professionals"\n` +
              `  Each slide: A bold, specific truth about African professional career life.\n` +
              `  Last slide: Ascentor — "This is exactly what Ascentor helps you master. Link in bio."\n\n` +
              `REEL SCRIPT:\n` +
              `  60–90 second script. Fast-paced, conversational, direct.\n` +
              `  Written as spoken word — short punchy sentences as a young professional would actually say them.\n` +
              `  Include [visual cue] markers.\n` +
              `  End with a confident Ascentor mention that feels like a recommendation, not an ad.\n\n` +
              `ENGAGEMENT POST:\n` +
              `  A question that African young professionals will actually want to answer in the comments.\n` +
              `  STRONG: "What is the one thing you wish someone had told you before your first performance review? Drop it below."\n` +
              `  WEAK: "What do you think about career development?"\n` +
              `  80–100 words caption. Max 2 emojis.\n\n` +
              `- Hashtag strategy: mix high-reach (#AfricanProfessionals, #CareerGrowth, #Ascentor) with niche relevant tags.\n` +
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
              `- THIS IS NOT A CORPORATE NEWSLETTER. It is a personal letter from the most insightful mentor you have ever had.\n` +
              `  It should feel like a voice message from someone who actually knows you, your industry, and your frustrations — transcribed into words.\n\n` +
              `SUBJECT LINE:\n` +
              `  Must feel personal, specific, and slightly uncomfortable in the best way.\n` +
              `  STRONG: "The meeting they had about your promotion — without you in the room"\n` +
              `  WEAK: "This week's career growth tips from Ascentor"\n\n` +
              `STRUCTURE:\n` +
              `1. HOOK (2–3 sentences): Drop them into a specific, recognisable African professional moment. Make them feel so seen they forward the email.\n` +
              `2. THE REAL TALK (150–200 words): The core insight. Address what is actually happening in African professional life right now.\n` +
              `   Be specific. Reference real dynamics. No platitudes.\n` +
              `3. WHAT WE HAVE SEEN (80–100 words): One pattern from Ascentor's coaching work.\n` +
              `   "In our sessions this week, we keep seeing..." or "The professionals who break through do this differently..."\n` +
              `   This is where Ascentor's authority shows — we have the data, the sessions, the results.\n` +
              `4. YOUR MOVE THIS WEEK (80–100 words): ONE specific, doable action. Not a list. One move.\n` +
              `   Make it concrete. Make it feel like it came from someone who knows what they are talking about.\n` +
              `5. SIGN-OFF: Warm. Human. Not corporate. Like a mentor closing a conversation.\n` +
              `   One natural mention of Ascentor — an invitation, not a sales pitch.\n\n` +
              `- Use \\n for line breaks.\n\n` +
              `Return: { "subject": "...", "preview_text": "under 90 chars — complements subject, creates curiosity", "body": "markdown with \\n breaks" }`,
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
      { pillar, week, status: "draft", platform: "Website", type: "Blog Post",
        title: (blog.title || topic).substring(0, 255), content_data: blog },
      ...linkedinPosts.map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "LinkedIn", type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`, content_data: p })),
      ...twitterThreads.map((t: any, i: number) => ({
        pillar, week, status: "draft", platform: "Twitter/X", type: "Twitter Thread",
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`, content_data: t })),
      ...instagramPosts.map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "Instagram", type: `Instagram ${p.type || "Post"}`,
        title: `IG: ${(p.caption || `Instagram ${i + 1}`).substring(0, 60)}...`, content_data: p })),
      { pillar, week, status: "draft", platform: "Email", type: "Email Newsletter",
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
      topic, pillar, week, audience, africanProfessionalAngle,
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
