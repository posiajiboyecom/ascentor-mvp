import {
  AUDIENCE_META
} from "../../../../chunk-DFGF2MF5.mjs";
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
} from "../../../../chunk-ZHF6YW46.mjs";
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
var SYSTEM = "You are a JSON API. Respond with ONLY a valid raw JSON object. Never use markdown code fences, backticks, or any text before or after the JSON. Your entire response must begin with { and end with }. CRITICAL JSON RULES: (1) All string values must be on ONE logical line — represent newlines as \\n (backslash-n), never as actual line breaks inside strings. (2) Never put a raw { or [ character inside a string value — escape it or rephrase. (3) Every string must be properly closed with a quote before the next field. (4) Never truncate the response — if running long, shorten the content, not the JSON structure.";
var ASCENTOR_BRAND = "ABOUT ASCENTOR: We are an AI-powered mentorship and leadership development platform built for ambitious professionals worldwide. We have worked with thousands of professionals across industries and continents. We know what works because we have been in the room — not because we studied it from outside. OUR VOICE: Warm. Direct. Authoritative. Deeply human. We speak with the confidence of a mentor who has earned it through results. NEVER say 'maybe try this', 'you might consider', 'it can be helpful to'. SAY: 'here is what we have seen work', 'professionals who do this get promoted 40% faster', 'the data from our sessions is clear'. THE GOLDEN RULE OF SPECIFICITY: Generic = invisible. Specific = shareable. NEVER write: 'career challenges', 'professional growth', 'navigate your career', 'achieve your goals'. ALWAYS write the EXACT situation: 'the performance review where you scored top marks and were still passed over', 'the meeting where you stayed quiet because no one taught you how to command that room', 'the salary negotiation you lost before it started because you named a number first'. If a reader can nod and say 'that is literally me right now' — you have it right. If a reader could insert their name into a template — rewrite it.";
var SEGMENT_CTA = {
  explorer: "CTA FRAMING FOR EXPLORER: Ascentor is the guide they always needed but never had. Speak to first steps, clarity, and having someone in your corner. STRONG: 'This is exactly what Ascentor Sage is built for — a mentor available at 2am before every big decision. Link in bio.' WEAK: 'Ascentor can help you with your career.'",
  builder: "CTA FRAMING FOR BUILDER: Ascentor is the edge that closes the gap between effort and recognition. STRONG: 'Ascentor members are not waiting to be discovered — they are engineering their visibility. This is the playbook. Join them.' WEAK: 'Check out Ascentor for career development.'",
  climber: "CTA FRAMING FOR CLIMBER: Ascentor is the strategic thinking partner senior leaders deserve. STRONG: 'The leaders making the right moves at this level are not doing it alone. This is the conversation Ascentor is built for.' WEAK: 'Ascentor has resources for senior professionals.'"
};
function getSegmentCTA(audience) {
  if (audience === "explorer") return SEGMENT_CTA.explorer;
  if (audience === "builder" || audience === "young_professional") return SEGMENT_CTA.builder;
  if (audience === "climber" || audience === "mid_career" || audience === "executive") return SEGMENT_CTA.climber;
  return SEGMENT_CTA.builder;
}
__name(getSegmentCTA, "getSegmentCTA");
var SEGMENT_SPECIFICITY = {
  explorer: "SPECIFICITY EXAMPLES FOR EXPLORER:\nGOOD: 'You have three browser tabs open — LinkedIn, a job listing, and your CV — and you have not moved in 40 minutes.'\nGOOD: 'Your degree says one thing. Your gut says another. And every adult in your life has a different opinion.'\nBAD: 'Starting your career can feel overwhelming and uncertain.'\nBAD: 'Many young professionals struggle to find direction.'\n",
  builder: "SPECIFICITY EXAMPLES FOR BUILDER:\nGOOD: 'You pitched the idea in Monday's meeting. It was ignored. On Friday, your director said it like it was his own. And everyone applauded.'\nGOOD: 'The colleague who got promoted has half your output and twice your visibility. You have been doing it backwards.'\nBAD: 'Many professionals feel overlooked in their careers.'\nBAD: 'Building visibility at work is an important skill for career advancement.'\n",
  climber: "SPECIFICITY EXAMPLES FOR CLIMBER:\nGOOD: 'You ran the numbers, built the case, and walked into that board meeting ready. They went with someone else's gut feeling.'\nGOOD: 'You are the most senior person in the room who still has no one to be honest with.'\nBAD: 'Leadership comes with unique challenges at every level.'\nBAD: 'Senior professionals often face complex career decisions.'\n"
};
function getSpecificity(audience) {
  if (audience === "explorer") return SEGMENT_SPECIFICITY.explorer;
  if (audience === "builder" || audience === "young_professional") return SEGMENT_SPECIFICITY.builder;
  if (audience === "climber" || audience === "mid_career" || audience === "executive") return SEGMENT_SPECIFICITY.climber;
  return SEGMENT_SPECIFICITY.builder;
}
__name(getSpecificity, "getSpecificity");
var contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 180,
  // increased — now 7 parallel calls
  run: /* @__PURE__ */ __name(async (payload) => {
    const {
      topic,
      pillar,
      week = 1,
      hooks = [],
      instagramHook = "",
      keyMessages = [],
      dataPoints = []
    } = payload;
    const audience = payload.stage ?? payload.audience ?? "builder";
    const professionalAngle = payload.professionalAngle || payload.africanProfessionalAngle || "";
    const audienceMeta = AUDIENCE_META[audience];
    const segmentCTA = getSegmentCTA(audience);
    const specificity = getSpecificity(audience);
    let recentTopicsBlock = "";
    try {
      const { data: recentItems } = await supabase.from("content_calendar").select("title, type, pillar, created_at").in("type", ["Blog Post", "Email Newsletter"]).order("created_at", { ascending: false }).limit(30);
      if (recentItems && recentItems.length > 0) {
        const recentList = recentItems.map((r) => `- "${r.title.replace(/^IG \w+: |^Thread: /, "")}"`).join("\n");
        recentTopicsBlock = `
DO NOT REPEAT — ALREADY PUBLISHED (last ${recentItems.length} pieces):
${recentList}
Every angle, hook, opening scenario, and key insight must be FRESH. If any of the above topics are related, approach from a completely different angle, different scenario, different reader moment, and different actionable takeaway.
`;
        logger.info(`[Writer] Loaded ${recentItems.length} recent titles for deduplication`);
      }
    } catch (e) {
      logger.warn(`[Writer] Could not load recent topics (non-fatal): ${e}`);
    }
    const VOICE_BLOCK = `${ASCENTOR_BRAND}

TARGET SEGMENT: ${audienceMeta.label}
WHO THEY ARE: ${audienceMeta.researchContext.split(".")[0]}.

VOICE RULES:
${audienceMeta.writerVoice}

${specificity}
` + (professionalAngle ? `CORE TRUTH THIS CONTENT MUST ADDRESS:
"${professionalAngle}"

` : "") + `${segmentCTA}
` + recentTopicsBlock;
    const keyMsgBlock = keyMessages.length > 0 ? `Key messages (weave in naturally — never as a list):
${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}

` : "";
    const dataBlock = dataPoints.length > 0 ? `Data points (cite naturally in prose — never as a bullet list):
${dataPoints.map((d) => `- ${d}`).join("\n")}

` : "";
    const hooksBlock = hooks.length >= 3 ? `Researched hooks:
- LinkedIn: ${hooks[0]}
- Twitter/X: ${hooks[1]}
- Email: ${hooks[2]}

` : "";
    if (payload.briefId) logger.info(`[Writer] briefId: ${payload.briefId}`);
    logger.info(`[Writer] Starting — "${topic}" | ${pillar} | segment: ${audience}`);
    logger.info("[Writer] Firing 7 Claude calls in parallel...");
    const [
      blogSettled,
      linkedinSettled,
      twitterSettled,
      igCarouselSettled,
      igReelSettled,
      igEngagementSettled,
      newsletterSettled
    ] = await Promise.allSettled([
      // ── 1. BLOG POST ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write a blog post for the Ascentor website.

${VOICE_BLOCK}TOPIC: "${topic}"
${keyMsgBlock}${dataBlock}BLOG REQUIREMENTS:
- 650–800 words. Tight. Every sentence earns its place.
- HEADLINE: Specific, punchy, speaks directly to a ${audienceMeta.label}'s real experience.
  STRONG: "Why the Hardest Workers in the Room Are Still Getting Passed Over for Promotion"
  WEAK: "How to Advance Your Career"
- OPENING PARAGRAPH: Drop into a specific, uncomfortable, recognisable ${audienceMeta.label} moment. Make them feel seen before you give them a single word of advice.
- 3 SUBHEADINGS: Each must feel like a chapter written specifically for the ${audienceMeta.label} stage — not generic career advice.
- EACH SECTION: Lead with the insight, ground it in a scenario, then give the practical application.
- ZERO sentences that could appear in any generic career article. Every point is specific to this stage and this topic.
- ASCENTOR CTA: Close with a confident, specific, single-sentence invitation.
- Represent ALL newlines as \\n in strings.

Return ONLY: { "title": "...", "content": "markdown using \\n for line breaks", "meta_description": "under 160 chars — specific and compelling", "cta": "one sentence" }`
        }]
      }),
      // ── 2. LINKEDIN POSTS ─────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2e3,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write 3 LinkedIn posts for Ascentor.

${VOICE_BLOCK}TOPIC: "${topic}"
${hooksBlock}${dataBlock}REQUIREMENTS:
- 3 posts: 2 VALUE posts + 1 SOCIAL PROOF post.
- Each post: 150–200 words.
- THE FIRST LINE IS EVERYTHING. Must stop scroll before "...see more".
  STRONG: "Nobody prepares you for the moment a less experienced colleague gets the promotion you worked two years for."
  WEAK: "Career development is important for every professional."
  The first line must name a SPECIFIC, PAINFUL, RECOGNISABLE ${audienceMeta.label} experience.
- VALUE POST: Hook → real insight grounded in ${audienceMeta.label} reality → 3–4 numbered actions (short, concrete, no jargon) → Ascentor CTA.
- SOCIAL PROOF POST: Open with a real result → the struggle → what changed → confident invite.
- Max 5 emojis per post. ZERO hashtags inside the post body — list them separately.
- Represent newlines as \\n in all string values.

Return ONLY: { "posts": [ { "type": "value|social_proof", "hook": "first line only", "content": "full post with \\n breaks", "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", "#Ascentor"] } ] }`
        }]
      }),
      // ── 3. TWITTER/X THREADS ──────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write 2 Twitter/X threads for Ascentor.

${VOICE_BLOCK}TOPIC: "${topic}"
${hooksBlock}REQUIREMENTS:
- 2 threads, 5–6 tweets each. Max 280 characters per tweet (count carefully).
- Thread 1: VALUE — practical insight grounded in ${audienceMeta.label} reality.
- Thread 2: STORY — a scenario any ${audienceMeta.label} immediately recognises, ending in a lesson.
- TWEET 1 (OPENER): Must feel like a direct call-out in the best possible way.
  STRONG: "The most talented person in the room is often the last to get promoted. Here is the specific reason why 🧵"
  WEAK: "Here are some career tips every professional needs to know 🧵"
- Each tweet: ONE idea. Short sentences. No padding. Written like a mentor sending you a message.
- Tweet 4 or 5: The insight that makes them want to screenshot and share immediately.
- Final tweet: Natural, non-salesy Ascentor mention.
- Max 2 emojis per tweet. ZERO region-specific language.

Return ONLY: { "threads": [ { "theme": "value|story", "opener": "tweet 1 text", "tweets": ["t1","t2","t3","t4","t5"], "cta": "final tweet text" } ] }`
        }]
      }),
      // ── 4. INSTAGRAM CAROUSEL ────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write ONE Instagram Carousel post for Ascentor.

${VOICE_BLOCK}TOPIC: "${topic}"
${instagramHook ? `Research hook: ${instagramHook}

` : ""}REQUIREMENTS:
- CAPTION: 100–130 words.
  Open with ONE sentence that makes a ${audienceMeta.label} immediately stop scrolling.
  STRONG: "The thing nobody tells you before your first big performance review — and the exact reason it blindsides most people."
  WEAK: "Here is some important advice for professionals at any stage."
  End with: "Save this — you will need it."
- SLIDES: Exactly 6 slides. Each slide: ONE punchy statement, max 12 words.
  Slide 1: The hook — what this carousel is about.
  Slides 2–5: A bold, specific truth about life at the ${audienceMeta.label} stage.
  Slide 6: "This is exactly what Ascentor is built for. Link in bio."
- Represent ALL newlines as \\n in string values.

Return ONLY: { "type": "carousel", "caption": "caption text with \\n breaks", "slides": ["slide 1 text", "slide 2 text", "slide 3 text", "slide 4 text", "slide 5 text", "slide 6 text"], "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", "#Ascentor", "#${audienceMeta.label.replace(/\s+/g, "")}"] }`
        }]
      }),
      // ── 5. INSTAGRAM REEL SCRIPT ─────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write ONE Instagram Reel script for Ascentor.

${VOICE_BLOCK}TOPIC: "${topic}"

REQUIREMENTS:
- CAPTION: 80–100 words. Punchy, conversational, directly written for a ${audienceMeta.label}.
  Opens with a one-line hook that makes them tap. ZERO corporate language.
- SCRIPT: 60–90 second spoken word. Fast-paced. Short sentences. Written exactly as someone would say it.
  Include [visual cue] markers like [look at camera], [text on screen: "..."], [cut to B-roll].
  Open strong: name a specific ${audienceMeta.label} experience in the first 5 seconds.
  Close with a natural Ascentor mention that feels like a recommendation from a friend.
- Represent ALL newlines as \\n in string values.

Return ONLY: { "type": "reel", "caption": "caption text with \\n breaks", "script": "full script with \\n breaks and [visual cues]", "slides": null, "hashtags": ["#AmbitiousProfessionals", "#CareerGrowth", "#Ascentor"] }`
        }]
      }),
      // ── 6. INSTAGRAM ENGAGEMENT POST ─────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write ONE Instagram Engagement post for Ascentor.

TARGET SEGMENT: ${audienceMeta.label}
TOPIC: "${topic}"

REQUIREMENTS:
- A question post designed to get ${audienceMeta.label}s talking in the comments.
- The question must be specific enough that they feel personally called out.
  STRONG: "What is the one thing you wish someone had told you before your first salary negotiation? Drop it below — someone reading this needs it."
  WEAK: "What do you think about career development? Let us know!"
  STRONG: "The moment you realised the job you thought you wanted was not actually the job you wanted — what happened next?"
  WEAK: "Have you ever faced challenges in your career journey?"
- CAPTION: 70–90 words. Set the question up in 2–3 sentences, then ask it. Max 2 emojis. ZERO corporate tone.
- Represent ALL newlines as \\n in string values.

Return ONLY: { "type": "engagement", "caption": "caption text with \\n breaks", "slides": null, "script": null, "hashtags": ["#AmbitiousProfessionals", "#CareerCommunity", "#Ascentor", "#${audienceMeta.label.replace(/\s+/g, "")}"] }`
        }]
      }),
      // ── 7. NEWSLETTER ─────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1600,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Write the weekly "The Ascentor Edge" newsletter.

${VOICE_BLOCK}TOPIC: "${topic}"
${dataBlock}${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}

` : ""}REQUIREMENTS:
- 450–550 words. Not a corporate newsletter. A personal letter from the most insightful mentor this ${audienceMeta.label} has ever had.

SUBJECT LINE:
  Personal, specific, slightly uncomfortable in the best way — written for a ${audienceMeta.label}.
  STRONG: "The meeting they had about your promotion — without you in the room"
  STRONG: "You passed the technical round. Here is why you still did not get the job."
  WEAK: "This week's career tips from Ascentor"
  WEAK: "Professional development advice for ambitious people"

STRUCTURE:
1. HOOK (2–3 sentences): A specific, recognisable ${audienceMeta.label} moment. So accurate they forward the email.
2. THE REAL TALK (150–200 words): The core insight. Be specific — name the exact situation, not the category.
3. WHAT WE HAVE SEEN (80–100 words): One pattern from Ascentor coaching sessions.
   Use: "In our sessions recently, we keep seeing..." — this is Ascentor's authority.
4. YOUR MOVE THIS WEEK (80–100 words): ONE specific, doable action. Not a list. One move. Make it concrete.
5. SIGN-OFF: Warm. Human. Not corporate. One natural Ascentor mention — invitation, not pitch.
- Represent ALL newlines as \\n in string values.

Return ONLY: { "subject": "...", "preview_text": "under 90 chars", "body": "markdown with \\n breaks" }`
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
    const instagramPosts = [];
    for (const [label, settled] of [
      ["IG Carousel", igCarouselSettled],
      ["IG Reel", igReelSettled],
      ["IG Engagement", igEngagementSettled]
    ]) {
      if (settled.status === "fulfilled") {
        try {
          const raw = settled.value.content[0].type === "text" ? settled.value.content[0].text : "";
          const parsed = extractJSON(raw);
          instagramPosts.push(parsed);
          logger.info(`[Writer] ${label} ok — type: ${parsed.type}`);
        } catch (e) {
          logger.error(`[Writer] ${label} parse failed: ${e}`);
        }
      } else {
        logger.error(`[Writer] ${label} API error: ${settled.reason}`);
      }
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
        audience,
        title: (blog.title || topic).substring(0, 255),
        content_data: blog
      },
      ...linkedinPosts.map((p, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "LinkedIn",
        type: "LinkedIn Post",
        audience,
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`,
        content_data: p
      })),
      ...twitterThreads.map((t, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "Twitter/X",
        type: "Twitter Thread",
        audience,
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`,
        content_data: t
      })),
      ...instagramPosts.map((p, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "Instagram",
        type: `Instagram ${(p.type || "post").charAt(0).toUpperCase() + (p.type || "post").slice(1)}`,
        audience,
        title: `IG ${p.type || "post"}: ${(p.caption || `Instagram ${i + 1}`).replace(/\\n/g, " ").replace(/\s+/g, " ").trim().substring(0, 60)}...`,
        content_data: p
      })),
      {
        pillar,
        week,
        status: "draft",
        platform: "Email",
        type: "Email Newsletter",
        audience,
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
      professionalAngle,
      generated: {
        blog: 1,
        linkedin_posts: linkedinPosts.length,
        twitter_threads: twitterThreads.length,
        instagram_carousel: instagramPosts.filter((p) => p.type === "carousel").length,
        instagram_reel: instagramPosts.filter((p) => p.type === "reel").length,
        instagram_engagement: instagramPosts.filter((p) => p.type === "engagement").length,
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
