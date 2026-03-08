import {
  AUDIENCE_META
} from "../../../../chunk-NX42ZRZV.mjs";
import {
  Anthropic
} from "../../../../chunk-V4ZTZ3EU.mjs";
import {
  createClient,
  dist_exports
} from "../../../../chunk-IFXSHHCG.mjs";
import {
  logger,
  task
} from "../../../../chunk-MN3LL5E3.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/content-writer.ts
init_esm();
var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
function extractJSON(raw) {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
  }
  function repairJSON(s) {
    let result = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        result += ch;
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        result += ch;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        result += ch;
        continue;
      }
      if (inString) {
        if (ch === "\n") {
          result += "\\n";
          continue;
        } else if (ch === "\r") {
          result += "\\r";
          continue;
        } else if (ch === "	") {
          result += "\\t";
          continue;
        }
      }
      result += ch;
    }
    return result;
  }
  __name(repairJSON, "repairJSON");
  try {
    return JSON.parse(repairJSON(text));
  } catch {
  }
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start !== -1) {
    const closer = text[start] === "{" ? "}" : "]";
    const lastClose = text.lastIndexOf(closer);
    if (lastClose > start) {
      const slice = text.slice(start, lastClose + 1);
      try {
        return JSON.parse(slice);
      } catch {
      }
      try {
        return JSON.parse(repairJSON(slice));
      } catch {
      }
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
      const recovered = keyMatch ? `{ "${keyMatch[1]}": [${truncated.slice(truncated.indexOf("[") + 1)}] }` : `{ "items": [${truncated.slice(truncated.indexOf("[") + 1)}] }`;
      try {
        return JSON.parse(recovered);
      } catch {
      }
      try {
        return JSON.parse(repairJSON(recovered));
      } catch {
      }
    }
  }
  throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 120)}`);
}
__name(extractJSON, "extractJSON");
var SYSTEM = "You are a JSON API. Respond with ONLY a valid raw JSON object. Never use markdown code fences. Never add text before or after the JSON. Your response must begin with { and end with }. CRITICAL: Inside JSON string values, represent newlines as the two characters \\n (backslash + n), never as actual line breaks. All string values must be on one line.";
var ASCENTOR_BRAND = "ABOUT ASCENTOR: We are an AI-powered mentorship and leadership development platform built specifically for African professionals. We have worked with thousands of professionals across the continent — we have seen the promotions, the plateaus, and the breakthroughs. We know what works because we have been in the room, not because we studied it from outside. OUR VOICE: Warm. Direct. Authoritative. Deeply human. We speak with the confidence of a mentor who has earned it through results — not the confidence of a brand running ads. We NEVER say 'maybe try this' or 'you might consider'. We say 'here is what we have seen work', 'professionals who do this get promoted 40% faster', 'the data from our sessions is clear'. OUR PROMISE TO READERS: We see you. We understand what it actually feels like to be talented, ambitious, and stuck in an environment that is not built to help you grow. We are the mentor most African professionals never had — and we are accessible. CONTENT MISSION: Every piece of content must do three things: 1. Make the reader feel deeply understood and seen. 2. Give them a genuine insight they can use immediately. 3. Show them, confidently and specifically, that Ascentor is the platform that closes their gap.";
var contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 120,
  run: /* @__PURE__ */ __name(async (payload) => {
    const {
      topic,
      pillar,
      week = 1,
      hooks = [],
      instagramHook = "",
      keyMessages = [],
      dataPoints = [],
      audience = "young_professional",
      africanProfessionalAngle = ""
    } = payload;
    const audienceMeta = AUDIENCE_META[audience];
    const VOICE_BLOCK = `${ASCENTOR_BRAND}

TARGET AUDIENCE: ${audienceMeta.label} — ${audienceMeta.ageRange} year olds.
WRITING VOICE RULES:
${audienceMeta.writerVoice}
` + (africanProfessionalAngle ? `
CORE AFRICAN PROFESSIONAL TRUTH TO ADDRESS IN THIS CONTENT:
"${africanProfessionalAngle}"
` : "") + `
CRITICAL LANGUAGE RULES FOR ALL CONTENT:
- ZERO country-specific slang (no "oga", "sharp sharp", "japa", "NYSC" etc.)
- Write for a pan-African professional audience — relatable Lagos to Nairobi to Johannesburg
- Speak to UNIVERSAL African career experiences — every reader should say "this is me"
- Ascentor's confidence is earned from results — use that authority in every sentence
- When mentioning Ascentor, show impact: "Ascentor members", "in our coaching sessions", "professionals who work with Ascentor" — not just "Ascentor can help"
`;
    const keyMsgBlock = keyMessages.length > 0 ? `
Key messages to weave into the content naturally:
${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}
` : "";
    const dataBlock = dataPoints.length > 0 ? `
Data points to use (cite them naturally, not as a list):
${dataPoints.map((d) => `- ${d}`).join("\n")}
` : "";
    const hooksBlock = hooks.length >= 3 ? `
Researched platform hooks:
- LinkedIn: ${hooks[0]}
- Twitter/X: ${hooks[1]}
- Email: ${hooks[2]}
` : "";
    if (payload.briefId) logger.info(`[Writer] briefId: ${payload.briefId}`);
    logger.info(`[Writer] Starting — "${topic}" | ${pillar} | audience: ${audience}`);
    logger.info("[Writer] Firing 5 Claude calls in parallel (blog, linkedin, twitter, instagram, newsletter)...");
    const [blogSettled, linkedinSettled, twitterSettled, instagramSettled, newsletterSettled] = await Promise.allSettled([
      // ── 1. BLOG POST ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write a blog post for the Ascentor website.

${VOICE_BLOCK}
TOPIC: "${topic}"
${keyMsgBlock}${dataBlock}
BLOG REQUIREMENTS:
- 650–800 words. Tight and purposeful — African professionals are busy, respect that.
- HEADLINE: Specific, punchy, and directly relevant to an African young professional's real experience.
  STRONG: "Why the Hardest Workers in the Room Are Still Getting Passed Over for Promotion"
  WEAK: "How to Advance Your Career at Work"
- OPENING PARAGRAPH: Drop the reader into a specific, recognisable moment. Make them feel seen before you say a word of advice.
  Example: "It is a Tuesday afternoon. You just sat through a meeting where the idea you shared three weeks ago was presented as new — by someone else. You smiled and said nothing. If that has happened to you, this post is written for you."
- 3 SUBHEADINGS: Each one should feel like a chapter in a book about their career life.
- EACH SECTION: Lead with the insight, ground it in a specific African professional scenario, then give the practical application.
- ZERO generic advice. Every point must feel written for someone building their career in an African city.
- ASCENTOR CTA: Close with a confident, specific invitation to Ascentor.
  STRONG: "This is exactly what Ascentor was built for. Our members are not waiting to be discovered — they are learning to engineer their visibility. Join them."
  WEAK: "Ascentor might be able to help you with this."
- SEO: naturally include terms like "career growth Africa", "African professional development", the pillar topic.
- Use \\n for line breaks.

Return: { "title": "...", "content": "markdown with \\n line breaks", "meta_description": "under 160 chars — specific and compelling", "cta": "..." }`
        }]
      }),
      // ── 2. LINKEDIN POSTS ─────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3e3,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write 3 LinkedIn posts for Ascentor.

${VOICE_BLOCK}
TOPIC: "${topic}"
${hooksBlock}${dataBlock}
LINKEDIN REQUIREMENTS:
- 3 posts total: 2 VALUE posts, 1 SOCIAL PROOF/ASCENTOR IMPACT post.
- Each post: 150–200 words.
- THE OPENING LINE IS EVERYTHING.
  It must stop the scroll BEFORE "...see more". It must name a specific, painful, recognisable African young professional experience.
  STRONG: "Nobody prepares you for the moment a less experienced colleague gets the promotion you worked two years for. Not HR. Not your manager. Nobody."
  WEAK: "Career development is crucial for professionals at every stage."
- VALUE POST STRUCTURE: Hook → The real insight (grounded in African professional reality) → 3–5 concrete actions → Ascentor CTA.
- SOCIAL PROOF POST STRUCTURE: Open with a real result we have seen → what the professional was struggling with → what changed → confident invitation to join.
  Frame as: "In our coaching sessions, we keep seeing this..." or "The professionals who break through do this one thing differently..."
- ASCENTOR CONFIDENCE: Use results-based framing. "Ascentor members who do this are promoted 40% faster" not "Ascentor can help you grow".
- Max 5 relevant emojis per post.
- Use \\n for line breaks.

Return: { "posts": [ { "type": "value|social_proof", "hook": "opening line only", "content": "full post with \\n breaks", "hashtags": ["#AfricanProfessionals", "#CareerGrowth", ...] } ] }`
        }]
      }),
      // ── 3. TWITTER/X THREADS ──────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2e3,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write 2 Twitter/X threads for Ascentor.

${VOICE_BLOCK}
TOPIC: "${topic}"
${hooksBlock}
TWITTER/X REQUIREMENTS:
- 2 threads, 5–6 tweets each. Under 280 characters per tweet.
- Thread 1: VALUE — practical insight, grounded in African professional reality.
- Thread 2: STORY — a scenario African young professionals recognise immediately, with a clear lesson.
- TWEET 1 (OPENER): This is the most important sentence you will write. It must make someone stop mid-scroll and feel called out in the best way.
  STRONG: "The most talented professional in the room is often the last one to get promoted. Here is why — and what actually changes it 🧵"
  WEAK: "Here are some career tips every professional should know 🧵"
- Each tweet: ONE clear, specific idea. Short sentences. Like a message from a mentor.
- Tweet 5: The insight that makes them want to save and share immediately.
- Final tweet: Natural mention of Ascentor — not an ad, a genuine invite from someone who knows what they are talking about.
- Max 2 emojis per tweet.
- ZERO country-specific slang.

Return: { "threads": [ { "opener": "tweet 1", "tweets": ["t1","t2","t3","t4","t5"], "cta": "final tweet", "theme": "value|story" } ] }`
        }]
      }),
      // ── 4. INSTAGRAM ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write 3 Instagram posts for Ascentor.

${VOICE_BLOCK}
TOPIC: "${topic}"
${instagramHook ? `Opening hook from research: ${instagramHook}

` : ""}${dataBlock}
INSTAGRAM REQUIREMENTS:
- 3 posts: 1 CAROUSEL (swipeable list), 1 REEL SCRIPT, 1 ENGAGEMENT post.

CAROUSEL POST:
  Caption: 100–150 words. Open with a single sentence that makes a young African professional immediately tap to read more.
  End caption with: "Save this post — you will need it."
  Slides (5–7 slides): Each slide is ONE punchy statement. Max 15 words per slide.
  Slide 1: The hook — what the whole carousel is about. Make them swipe.
    STRONG Slide 1: "What your organisation is not telling you about how promotions actually work"
    WEAK Slide 1: "Career tips for professionals"
  Each slide: A bold, specific truth about African professional career life.
  Last slide: Ascentor — "This is exactly what Ascentor helps you master. Link in bio."

REEL SCRIPT:
  60–90 second script. Fast-paced, conversational, direct.
  Written as spoken word — short punchy sentences as a young professional would actually say them.
  Include [visual cue] markers.
  End with a confident Ascentor mention that feels like a recommendation, not an ad.

ENGAGEMENT POST:
  A question that African young professionals will actually want to answer in the comments.
  STRONG: "What is the one thing you wish someone had told you before your first performance review? Drop it below."
  WEAK: "What do you think about career development?"
  80–100 words caption. Max 2 emojis.

- Hashtag strategy: mix high-reach (#AfricanProfessionals, #CareerGrowth, #Ascentor) with niche relevant tags.
- Use \\n for line breaks.

Return: { "posts": [ { "type": "carousel|reel|engagement", "caption": "...", "slides": ["slide 1",...] or null, "script": "..." or null, "hashtags": [...] } ] }`
        }]
      }),
      // ── 5. NEWSLETTER ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write the weekly "The Ascentor Edge" newsletter.

${VOICE_BLOCK}
TOPIC: "${topic}"
${dataBlock}${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}
` : ""}
NEWSLETTER REQUIREMENTS:
- 450–550 words. Every paragraph must earn its place.
- THIS IS NOT A CORPORATE NEWSLETTER. It is a personal letter from the most insightful mentor you have ever had.
  It should feel like a voice message from someone who actually knows you, your industry, and your frustrations — transcribed into words.

SUBJECT LINE:
  Must feel personal, specific, and slightly uncomfortable in the best way.
  STRONG: "The meeting they had about your promotion — without you in the room"
  WEAK: "This week's career growth tips from Ascentor"

STRUCTURE:
1. HOOK (2–3 sentences): Drop them into a specific, recognisable African professional moment. Make them feel so seen they forward the email.
2. THE REAL TALK (150–200 words): The core insight. Address what is actually happening in African professional life right now.
   Be specific. Reference real dynamics. No platitudes.
3. WHAT WE HAVE SEEN (80–100 words): One pattern from Ascentor's coaching work.
   "In our sessions this week, we keep seeing..." or "The professionals who break through do this differently..."
   This is where Ascentor's authority shows — we have the data, the sessions, the results.
4. YOUR MOVE THIS WEEK (80–100 words): ONE specific, doable action. Not a list. One move.
   Make it concrete. Make it feel like it came from someone who knows what they are talking about.
5. SIGN-OFF: Warm. Human. Not corporate. Like a mentor closing a conversation.
   One natural mention of Ascentor — an invitation, not a sales pitch.

- Use \\n for line breaks.

Return: { "subject": "...", "preview_text": "under 90 chars — complements subject, creates curiosity", "body": "markdown with \\n breaks" }`
        }]
      })
    ]);
    let blog = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        logger.info(`[Writer] Blog raw (first 300): ${raw.slice(0, 300)}`);
        blog = extractJSON(raw);
        logger.info(`[Writer] Blog ok — "${blog.title}"`);
      } catch (e) {
        logger.error(`[Writer] Blog parse failed: ${e}`);
      }
    } else {
      logger.error(`[Writer] Blog API error: ${blogSettled.reason}`);
    }
    let linkedinPosts = [];
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        linkedinPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Writer] LinkedIn ok — ${linkedinPosts.length} posts`);
      } catch (e) {
        logger.error(`[Writer] LinkedIn parse failed: ${e}`);
      }
    } else {
      logger.error(`[Writer] LinkedIn API error: ${linkedinSettled.reason}`);
    }
    let twitterThreads = [];
    if (twitterSettled.status === "fulfilled") {
      try {
        const raw = twitterSettled.value.content[0].type === "text" ? twitterSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        twitterThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
        logger.info(`[Writer] Twitter ok — ${twitterThreads.length} threads`);
      } catch (e) {
        logger.error(`[Writer] Twitter parse failed: ${e}`);
      }
    } else {
      logger.error(`[Writer] Twitter API error: ${twitterSettled.reason}`);
    }
    let instagramPosts = [];
    if (instagramSettled.status === "fulfilled") {
      try {
        const raw = instagramSettled.value.content[0].type === "text" ? instagramSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        instagramPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Writer] Instagram ok — ${instagramPosts.length} posts`);
      } catch (e) {
        logger.error(`[Writer] Instagram parse failed: ${e}`);
      }
    } else {
      logger.error(`[Writer] Instagram API error: ${instagramSettled.reason}`);
    }
    let newsletter = { subject: `The Ascentor Edge: ${topic}`, preview_text: "", body: "" };
    if (newsletterSettled.status === "fulfilled") {
      try {
        const raw = newsletterSettled.value.content[0].type === "text" ? newsletterSettled.value.content[0].text : "";
        newsletter = extractJSON(raw);
        logger.info(`[Writer] Newsletter ok — "${newsletter.subject}"`);
      } catch (e) {
        logger.error(`[Writer] Newsletter parse failed: ${e}`);
      }
    } else {
      logger.error(`[Writer] Newsletter API error: ${newsletterSettled.reason}`);
    }
    const items = [
      {
        pillar,
        week,
        status: "draft",
        platform: "Website",
        type: "Blog Post",
        title: (blog.title || topic).substring(0, 255),
        content_data: blog
      },
      ...linkedinPosts.map((p, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "LinkedIn",
        type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`,
        content_data: p
      })),
      ...twitterThreads.map((t, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "Twitter/X",
        type: "Twitter Thread",
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`,
        content_data: t
      })),
      ...instagramPosts.map((p, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "Instagram",
        type: `Instagram ${p.type || "Post"}`,
        title: `IG: ${(p.caption || `Instagram ${i + 1}`).substring(0, 60)}...`,
        content_data: p
      })),
      {
        pillar,
        week,
        status: "draft",
        platform: "Email",
        type: "Email Newsletter",
        title: (newsletter.subject || `The Ascentor Edge: ${topic}`).substring(0, 255),
        content_data: newsletter
      }
    ];
    let insertedCount = 0;
    for (const item of items) {
      const { error } = await supabase.from("content_calendar").insert(item);
      if (error) logger.error(`[Writer] Insert failed "${item.title}": ${JSON.stringify(error)}`);
      else insertedCount++;
    }
    logger.info(`[Writer] Saved ${insertedCount}/${items.length} rows to content_calendar`);
    const summary = {
      topic,
      pillar,
      week,
      audience,
      africanProfessionalAngle,
      generated: {
        blog: 1,
        linkedin_posts: linkedinPosts.length,
        twitter_threads: twitterThreads.length,
        instagram_posts: instagramPosts.length,
        newsletter: 1
      },
      total_items: items.length,
      inserted: insertedCount
    };
    logger.info("[Writer] Done:", summary);
    return summary;
  }, "run")
});
export {
  contentWriterAgent
};
//# sourceMappingURL=content-writer.mjs.map
