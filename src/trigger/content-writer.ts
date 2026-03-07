// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer — Nigerian Professional Edition
//
// Key upgrades:
//   - 5 platform-specific Nigerian voice prompts (LinkedIn, Twitter/X,
//     Instagram, Blog, Newsletter) — each platform gets its OWN voice
//   - nigerianContext field from researcher anchors all content
//   - Ascentor brand confidence mandate: we don't beg for attention,
//     we demonstrate authority through deep cultural understanding
//   - "Relatable daily experience" as a non-negotiable quality gate
//   - Instagram added as a full platform (was missing before)
//   - Parallel generation preserved for speed (free tier safe)
//
// Free tier constraints preserved:
//   - Haiku model throughout
//   - maxDuration 120s (5 parallel calls ~15-25s total)
//   - Robust JSON extraction unchanged
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

// ── Robust JSON Extractor (unchanged — battle-tested) ─────────
function extractJSON(raw: string): any {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  try { return JSON.parse(text); } catch { /* continue */ }

  function repairJSON(s: string): string {
    let result = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) { result += ch; escape = false; continue; }
      if (ch === "\\") { escape = true; result += ch; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }
      if (inString) {
        if      (ch === "\n") { result += "\\n";  continue; }
        else if (ch === "\r") { result += "\\r";  continue; }
        else if (ch === "\t") { result += "\\t";  continue; }
      }
      result += ch;
    }
    return result;
  }

  try { return JSON.parse(repairJSON(text)); } catch { /* continue */ }

  const firstBrace   = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const start =
    firstBrace === -1   ? firstBracket :
    firstBracket === -1 ? firstBrace :
    Math.min(firstBrace, firstBracket);

  if (start !== -1) {
    const closer = text[start] === "{" ? "}" : "]";
    const lastClose = text.lastIndexOf(closer);
    if (lastClose > start) {
      const slice = text.slice(start, lastClose + 1);
      try { return JSON.parse(slice); } catch { /* continue */ }
      try { return JSON.parse(repairJSON(slice)); } catch { /* continue */ }
    }
  }

  const arrayStart = text.indexOf("[");
  if (arrayStart !== -1) {
    const lastCompleteClose = (() => {
      let depth = 0;
      let lastGoodClose = -1;
      for (let i = arrayStart; i < text.length; i++) {
        if (text[i] === "{") depth++;
        if (text[i] === "}") {
          depth--;
          if (depth === 0) lastGoodClose = i;
        }
      }
      return lastGoodClose;
    })();

    if (lastCompleteClose > arrayStart) {
      const truncated = text.slice(0, lastCompleteClose + 1);
      const keyMatch = text.slice(0, arrayStart).match(/"(\w+)"\s*:\s*\[?\s*$/);
      const recovered = keyMatch
        ? `{ "${keyMatch[1]}": [${truncated.slice(truncated.indexOf("[") + 1)}] }`
        : `{ "items": [${truncated.slice(truncated.indexOf("[") + 1)}] }`;
      try { return JSON.parse(recovered); } catch { /* continue */ }
      try { return JSON.parse(repairJSON(recovered)); } catch { /* continue */ }
    }
  }

  throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 120)}`);
}

// ── System Prompt ─────────────────────────────────────────────
const SYSTEM =
  "You are a JSON API. Respond with ONLY a valid raw JSON object. " +
  "Never use markdown code fences. Never add text before or after the JSON. " +
  "Your response must begin with { and end with }. " +
  "CRITICAL: Inside JSON string values, represent newlines as the two characters \\n (backslash + n), " +
  "never as actual line breaks. All string values must be on one line.";

// ── Brand Identity Block (injected into every prompt) ─────────
// This ensures every piece of content communicates Ascentor's
// authority and confidence — never desperate, always assured.
const ASCENTOR_BRAND =
  `ABOUT ASCENTOR:\n` +
  `Ascentor is Nigeria's most intelligent career and leadership development platform. ` +
  `We combine AI coaching (Sage), real human mentors, and peer circles to help Nigerian professionals ` +
  `grow faster than their environment would normally allow. We are not another motivational page. ` +
  `We are a system. We deliver results.\n\n` +
  `BRAND VOICE RULES (non-negotiable):\n` +
  `1. CONFIDENT, never arrogant — we know what we're doing and let results speak\n` +
  `2. DEEPLY ROOTED in Nigerian professional reality — Lagos traffic, naira salary pressure, office politics, JAPA debate\n` +
  `3. WARM but not soft — we speak like a mentor who genuinely wants you to win\n` +
  `4. NEVER generic — every post must feel like it was written FOR a specific Nigerian professional\n` +
  `5. CTA always feels like an invitation, not a sales pitch\n`;

export const contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 120,
  run: async (payload: {
    topic: string;
    pillar: "leadership" | "career" | "ai" | "coaching" | "community";
    week?: number;
    triggeredBy?: string;
    briefId?: string | null;
    hooks?: string | Record<string, string> | any; // platform-specific hooks object from researcher
    keyMessages?: string[];
    dataPoints?: string[];
    audience?: AudiencePreset;
    nigerianContext?: string;  // NEW: specific Nigerian scenario from researcher
    angle?: string;            // NEW: our unique take from researcher
    targetAudience?: string;   // NEW: hyper-specific persona
  }) => {
    const {
      topic, pillar, week = 1,
      keyMessages = [], dataPoints = [],
      audience = 'young_professional', // default to primary growth audience
      nigerianContext = '',
      angle = '',
      targetAudience = '',
    } = payload;

    // Normalise hooks — researcher now sends an object, not an array
    const hooksObj: Record<string, string> = (() => {
      if (payload.hooks && typeof payload.hooks === 'object' && !Array.isArray(payload.hooks)) {
        return payload.hooks as Record<string, string>;
      }
      // Legacy array format fallback
      const arr: string[] = Array.isArray(payload.hooks) ? payload.hooks : [];
      return {
        linkedin:  arr[0] || '',
        twitter:   arr[1] || '',
        instagram: arr[2] || '',
        email:     arr[3] || '',
      };
    })();

    const audienceMeta = AUDIENCE_META[audience];
    const voices = audienceMeta.voices;

    if (payload.briefId) logger.info(`[Content Writer] briefId: ${payload.briefId}`);
    logger.info(`[Content Writer] Starting — "${topic}" | ${pillar} | audience: ${audience}`);

    // ── Context blocks ──────────────────────────────────────
    const keyMsgBlock = keyMessages.length > 0
      ? `Key messages to weave in:\n${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}` : "";
    const dataBlock = dataPoints.length > 0
      ? `Data points / stats to reference:\n${dataPoints.map(d => `- ${d}`).join("\n")}` : "";
    const nigerianBlock = nigerianContext
      ? `Nigerian context anchor (use this as your opening scenario or reference point):\n"${nigerianContext}"` : "";
    const angleBlock = angle
      ? `Our unique angle: ${angle}` : "";
    const personaBlock = targetAudience
      ? `Writing for: ${targetAudience}` : `Writing for: ${audienceMeta.fallbackPersona}`;

    logger.info("[Content Writer] Firing 5 platform calls in parallel...");

    const [
      blogSettled,
      linkedinSettled,
      twitterSettled,
      instagramSettled,
      newsletterSettled,
    ] = await Promise.allSettled([

      // ── BLOG POST ───────────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1600,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `${ASCENTOR_BRAND}\n` +
            `Write a blog post for Ascentor.\n\n` +
            `VOICE: ${voices.blog}\n\n` +
            `${personaBlock}\n` +
            `Topic: "${topic}"\n` +
            `${nigerianBlock}\n` +
            `${angleBlock}\n` +
            `${keyMsgBlock}\n` +
            `${dataBlock}\n\n` +
            `REQUIREMENTS:\n` +
            `- 650-850 words\n` +
            `- Open with a SPECIFIC scenario a Nigerian professional will immediately recognise ` +
            `(not a generic opener — put them IN a real moment)\n` +
            `- 3-4 subheadings that are punchlines, not labels\n` +
            `- Reference Nigerian business context at least twice (companies, cities, salaries in naira, cultural moments)\n` +
            `- CTA at the end: invite them to try Ascentor's Sage AI or join a circle — phrase it as a gift, not a pitch\n` +
            `- Use \\n for line breaks inside the content string\n\n` +
            `Return: { "title": "...", "content": "markdown with \\n line breaks", "meta_description": "155 chars max", "cta": "..." }`,
        }],
      }),

      // ── LINKEDIN POSTS ──────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `${ASCENTOR_BRAND}\n` +
            `Write 3 LinkedIn posts for Ascentor.\n\n` +
            `VOICE: ${voices.linkedin}\n\n` +
            `${personaBlock}\n` +
            `Topic: "${topic}"\n` +
            `${nigerianBlock}\n` +
            `${angleBlock}\n` +
            `${hooksObj.linkedin ? `Suggested opening line: "${hooksObj.linkedin}"` : ''}\n` +
            `${dataBlock}\n\n` +
            `REQUIREMENTS for all 3 posts:\n` +
            `- Post 1 (VALUE): 160-200 words. Opens with a one-liner that sounds like a hard truth. ` +
            `References Nigerian professional reality specifically. Heavy use of line breaks for readability. ` +
            `Ends with an engaging question.\n` +
            `- Post 2 (VALUE): 160-200 words. Teach something concrete — a framework, a tactic, or a reframe. ` +
            `Use a real Nigerian work scenario. Ends with a soft Ascentor mention.\n` +
            `- Post 3 (SOCIAL PROOF / CONFIDENCE): 140-180 words. Write as Ascentor brand voice. ` +
            `Communicate authority and results without bragging. ` +
            `E.g. what members are achieving, what Sage AI helps with, why professionals trust us. ` +
            `Must feel proud but not arrogant.\n\n` +
            `Return: { "posts": [ { "type": "value|value|social_proof", "hook": "first line", "content": "post with \\n breaks" } ] }`,
        }],
      }),

      // ── TWITTER/X THREADS ───────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `${ASCENTOR_BRAND}\n` +
            `Write 2 Twitter/X threads for Ascentor.\n\n` +
            `VOICE: ${voices.twitter}\n\n` +
            `${personaBlock}\n` +
            `Topic: "${topic}"\n` +
            `${nigerianBlock}\n` +
            `${hooksObj.twitter ? `Suggested opener: "${hooksObj.twitter}"` : ''}\n\n` +
            `REQUIREMENTS:\n` +
            `- Thread 1: 6 tweets. Opens with a HOT TAKE that a Nigerian professional on Twitter/X will retweet. ` +
            `Tweets 2-5: each is a distinct insight, tactic, or uncomfortable truth. ` +
            `Reference real Nigerian scenarios at least twice (NYSC, Lagos traffic, "my oga", naira salaries, JAPA). ` +
            `Tweet 6: CTA — invite them to Ascentor. Frame it as "for people serious about X".\n` +
            `- Thread 2: 5 tweets. More conversational — like sharing a personal story or lesson. ` +
            `End with a question that drives comments.\n` +
            `- Each tweet max 280 chars. Number them: "1/", "2/" etc.\n\n` +
            `Return: { "threads": [ { "opener": "hook tweet", "tweets": ["1/ ...", "2/ ...", "3/ ...", "4/ ...", "5/ ...", "6/ ..."], "cta": "final cta tweet" } ] }`,
        }],
      }),

      // ── INSTAGRAM CAPTIONS ──────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `${ASCENTOR_BRAND}\n` +
            `Write 3 Instagram captions for Ascentor.\n\n` +
            `VOICE: ${voices.instagram}\n\n` +
            `${personaBlock}\n` +
            `Topic: "${topic}"\n` +
            `${nigerianBlock}\n` +
            `${hooksObj.instagram ? `Suggested hook: "${hooksObj.instagram}"` : ''}\n\n` +
            `REQUIREMENTS for all 3 captions:\n` +
            `- Caption 1 (RELATABLE PAIN POINT): 80-120 words. ` +
            `Open with a sentence that makes them stop scrolling — ideally a scenario they lived through. ` +
            `Reference something distinctly Nigerian. End with a question or "save this post".\n` +
            `- Caption 2 (QUICK TIP / CAROUSEL STYLE): 80-100 words. ` +
            `"3 things [audience] need to know about [topic]" style. Short punchy lines. ` +
            `End with: "Swipe for the full breakdown 👉" or similar.\n` +
            `- Caption 3 (BRAND CONFIDENCE): 60-80 words. Speak as Ascentor with pride. ` +
            `"At Ascentor, we built X because..." type of energy. Must be warm, not corporate.\n` +
            `- Each caption ends with 5-8 hashtags. Mix: #NigerianProfessionals #LagosCareer ` +
            `#AscentorNG #CareerGrowthNigeria + 2-3 topic-specific tags.\n\n` +
            `Return: { "captions": [ { "type": "pain_point|tip|brand", "caption": "text with \\n for line breaks", "hashtags": ["tag1","tag2"] } ] }`,
        }],
      }),

      // ── EMAIL NEWSLETTER ────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `${ASCENTOR_BRAND}\n` +
            `Write the weekly Ascentor newsletter: "The Career Edge" — for Nigerian professionals.\n\n` +
            `VOICE: ${voices.newsletter}\n\n` +
            `${personaBlock}\n` +
            `Topic: "${topic}"\n` +
            `${nigerianBlock}\n` +
            `${angleBlock}\n` +
            `${hooksObj.email ? `Subject line idea: "${hooksObj.email}"` : ''}\n` +
            `${dataBlock}\n\n` +
            `STRUCTURE (450-600 words total):\n` +
            `1. Subject line: curiosity + benefit + Nigeria signal (max 50 chars)\n` +
            `2. Preview text: makes them open it (max 90 chars)\n` +
            `3. Opening: 2-3 sentences — drop them into a real Nigerian professional scenario immediately\n` +
            `4. The Insight: the core lesson or truth (150-200 words) — use \\n for paragraphs\n` +
            `5. The Practical: 2-3 specific things they can do this week. Real actions, not vague advice.\n` +
            `6. Ascentor Moment: 2-3 sentences. Tell them what Sage AI or Ascentor circles can do for THIS specific problem. ` +
            `Tone: "we built this for exactly this moment" — confident and warm.\n` +
            `7. Sign-off: warm, mentor-style. Not "Best regards". More like how a real mentor ends a voice note.\n\n` +
            `Return: { "subject": "...", "preview_text": "90 chars max", "body": "full email with \\n breaks" }`,
        }],
      }),
    ]);

    // ── Parse all results ─────────────────────────────────────
    let blog: any = {
      title: topic,
      content: "Draft pending review",
      meta_description: "",
      cta: "",
    };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        logger.info(`[Content Writer] Blog raw (first 300): ${raw.slice(0, 300)}`);
        blog = extractJSON(raw);
        logger.info(`[Content Writer] Blog ok — "${blog.title}"`);
      } catch (e) { logger.error(`[Content Writer] Blog parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Blog API error: ${blogSettled.reason}`); }

    let linkedinPosts: any[] = [];
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        logger.info(`[Content Writer] LinkedIn raw (first 300): ${raw.slice(0, 300)}`);
        const parsed = extractJSON(raw);
        linkedinPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Content Writer] LinkedIn ok — ${linkedinPosts.length} posts`);
      } catch (e) { logger.error(`[Content Writer] LinkedIn parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] LinkedIn API error: ${linkedinSettled.reason}`); }

    let twitterThreads: any[] = [];
    if (twitterSettled.status === "fulfilled") {
      try {
        const raw = twitterSettled.value.content[0].type === "text" ? twitterSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        twitterThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
        logger.info(`[Content Writer] Twitter ok — ${twitterThreads.length} threads`);
      } catch (e) { logger.error(`[Content Writer] Twitter parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Twitter API error: ${twitterSettled.reason}`); }

    let instagramCaptions: any[] = [];
    if (instagramSettled.status === "fulfilled") {
      try {
        const raw = instagramSettled.value.content[0].type === "text" ? instagramSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        instagramCaptions = Array.isArray(parsed.captions) ? parsed.captions : [];
        logger.info(`[Content Writer] Instagram ok — ${instagramCaptions.length} captions`);
      } catch (e) { logger.error(`[Content Writer] Instagram parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Instagram API error: ${instagramSettled.reason}`); }

    let newsletter: any = {
      subject: `The Career Edge: ${topic}`,
      preview_text: "",
      body: "",
    };
    if (newsletterSettled.status === "fulfilled") {
      try {
        const raw = newsletterSettled.value.content[0].type === "text" ? newsletterSettled.value.content[0].text : "";
        newsletter = extractJSON(raw);
        logger.info(`[Content Writer] Newsletter ok — "${newsletter.subject}"`);
      } catch (e) { logger.error(`[Content Writer] Newsletter parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Newsletter API error: ${newsletterSettled.reason}`); }

    // ── Build content_calendar rows ────────────────────────────
    const items = [
      {
        pillar, week, status: "draft", platform: "Website",
        type: "Blog Post",
        title: (blog.title || topic).substring(0, 255),
        content_data: blog,
        audience,
      },
      ...linkedinPosts.map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "LinkedIn",
        type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`,
        content_data: p,
        audience,
      })),
      ...twitterThreads.map((t: any, i: number) => ({
        pillar, week, status: "draft", platform: "Twitter/X",
        type: "Twitter Thread",
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`,
        content_data: t,
        audience,
      })),
      ...instagramCaptions.map((c: any, i: number) => ({
        pillar, week, status: "draft", platform: "Instagram",
        type: "Instagram Caption",
        title: `IG: ${(c.caption || `Caption ${i + 1}`).substring(0, 50)}...`,
        content_data: c,
        audience,
      })),
      {
        pillar, week, status: "draft", platform: "Email",
        type: "Email Newsletter",
        title: (newsletter.subject || `The Career Edge: ${topic}`).substring(0, 255),
        content_data: newsletter,
        audience,
      },
    ];

    // ── Insert one-by-one ─────────────────────────────────────
    let insertedCount = 0;
    for (const item of items) {
      const { error } = await supabase
        .from("content_calendar")
        .insert(item);

      if (error) {
        logger.error(`[Content Writer] Insert failed "${item.title}": ${JSON.stringify(error)}`);
      } else {
        insertedCount++;
      }
    }

    logger.info(`[Content Writer] Saved ${insertedCount}/${items.length} rows`);

    const summary = {
      topic, pillar, week, audience,
      nigerianContext,
      generated: {
        blog: 1,
        linkedin_posts: linkedinPosts.length,
        twitter_threads: twitterThreads.length,
        instagram_captions: instagramCaptions.length,
        newsletter: 1,
      },
      total_items: items.length,
      inserted: insertedCount,
    };

    logger.info("[Content Writer] Done:", summary);
    return summary;
  },
});
