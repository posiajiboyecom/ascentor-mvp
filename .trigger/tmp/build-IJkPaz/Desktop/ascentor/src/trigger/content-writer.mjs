import {
  AUDIENCE_META
} from "../../../../chunk-YRCINLON.mjs";
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
var ASCENTOR_BRAND = `ABOUT ASCENTOR:
Ascentor is Nigeria's most intelligent career and leadership development platform. We combine AI coaching (Sage), real human mentors, and peer circles to help Nigerian professionals grow faster than their environment would normally allow. We are not another motivational page. We are a system. We deliver results.

BRAND VOICE RULES (non-negotiable):
1. CONFIDENT, never arrogant — we know what we're doing and let results speak
2. DEEPLY ROOTED in Nigerian professional reality — Lagos traffic, naira salary pressure, office politics, JAPA debate
3. WARM but not soft — we speak like a mentor who genuinely wants you to win
4. NEVER generic — every post must feel like it was written FOR a specific Nigerian professional
5. CTA always feels like an invitation, not a sales pitch
`;
var contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 120,
  run: /* @__PURE__ */ __name(async (payload) => {
    const {
      topic,
      pillar,
      week = 1,
      keyMessages = [],
      dataPoints = [],
      audience = "young_professional",
      // default to primary growth audience
      nigerianContext = "",
      angle = "",
      targetAudience = ""
    } = payload;
    const hooksObj = (() => {
      if (payload.hooks && typeof payload.hooks === "object" && !Array.isArray(payload.hooks)) {
        return payload.hooks;
      }
      const arr = Array.isArray(payload.hooks) ? payload.hooks : [];
      return {
        linkedin: arr[0] || "",
        twitter: arr[1] || "",
        instagram: arr[2] || "",
        email: arr[3] || ""
      };
    })();
    const audienceMeta = AUDIENCE_META[audience];
    const voices = audienceMeta.voices;
    if (payload.briefId) logger.info(`[Content Writer] briefId: ${payload.briefId}`);
    logger.info(`[Content Writer] Starting — "${topic}" | ${pillar} | audience: ${audience}`);
    const keyMsgBlock = keyMessages.length > 0 ? `Key messages to weave in:
${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}` : "";
    const dataBlock = dataPoints.length > 0 ? `Data points / stats to reference:
${dataPoints.map((d) => `- ${d}`).join("\n")}` : "";
    const nigerianBlock = nigerianContext ? `Nigerian context anchor (use this as your opening scenario or reference point):
"${nigerianContext}"` : "";
    const angleBlock = angle ? `Our unique angle: ${angle}` : "";
    const personaBlock = targetAudience ? `Writing for: ${targetAudience}` : `Writing for: ${audienceMeta.fallbackPersona}`;
    logger.info("[Content Writer] Firing 5 platform calls in parallel...");
    const [
      blogSettled,
      linkedinSettled,
      twitterSettled,
      instagramSettled,
      newsletterSettled
    ] = await Promise.allSettled([
      // ── BLOG POST ───────────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1600,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `${ASCENTOR_BRAND}
Write a blog post for Ascentor.

VOICE: ${voices.blog}

${personaBlock}
Topic: "${topic}"
${nigerianBlock}
${angleBlock}
${keyMsgBlock}
${dataBlock}

REQUIREMENTS:
- 650-850 words
- Open with a SPECIFIC scenario a Nigerian professional will immediately recognise (not a generic opener — put them IN a real moment)
- 3-4 subheadings that are punchlines, not labels
- Reference Nigerian business context at least twice (companies, cities, salaries in naira, cultural moments)
- CTA at the end: invite them to try Ascentor's Sage AI or join a circle — phrase it as a gift, not a pitch
- Use \\n for line breaks inside the content string

Return: { "title": "...", "content": "markdown with \\n line breaks", "meta_description": "155 chars max", "cta": "..." }`
        }]
      }),
      // ── LINKEDIN POSTS ──────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3e3,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `${ASCENTOR_BRAND}
Write 3 LinkedIn posts for Ascentor.

VOICE: ${voices.linkedin}

${personaBlock}
Topic: "${topic}"
${nigerianBlock}
${angleBlock}
${hooksObj.linkedin ? `Suggested opening line: "${hooksObj.linkedin}"` : ""}
${dataBlock}

REQUIREMENTS for all 3 posts:
- Post 1 (VALUE): 160-200 words. Opens with a one-liner that sounds like a hard truth. References Nigerian professional reality specifically. Heavy use of line breaks for readability. Ends with an engaging question.
- Post 2 (VALUE): 160-200 words. Teach something concrete — a framework, a tactic, or a reframe. Use a real Nigerian work scenario. Ends with a soft Ascentor mention.
- Post 3 (SOCIAL PROOF / CONFIDENCE): 140-180 words. Write as Ascentor brand voice. Communicate authority and results without bragging. E.g. what members are achieving, what Sage AI helps with, why professionals trust us. Must feel proud but not arrogant.

Return: { "posts": [ { "type": "value|value|social_proof", "hook": "first line", "content": "post with \\n breaks" } ] }`
        }]
      }),
      // ── TWITTER/X THREADS ───────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2e3,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `${ASCENTOR_BRAND}
Write 2 Twitter/X threads for Ascentor.

VOICE: ${voices.twitter}

${personaBlock}
Topic: "${topic}"
${nigerianBlock}
${hooksObj.twitter ? `Suggested opener: "${hooksObj.twitter}"` : ""}

REQUIREMENTS:
- Thread 1: 6 tweets. Opens with a HOT TAKE that a Nigerian professional on Twitter/X will retweet. Tweets 2-5: each is a distinct insight, tactic, or uncomfortable truth. Reference real Nigerian scenarios at least twice (NYSC, Lagos traffic, "my oga", naira salaries, JAPA). Tweet 6: CTA — invite them to Ascentor. Frame it as "for people serious about X".
- Thread 2: 5 tweets. More conversational — like sharing a personal story or lesson. End with a question that drives comments.
- Each tweet max 280 chars. Number them: "1/", "2/" etc.

Return: { "threads": [ { "opener": "hook tweet", "tweets": ["1/ ...", "2/ ...", "3/ ...", "4/ ...", "5/ ...", "6/ ..."], "cta": "final cta tweet" } ] }`
        }]
      }),
      // ── INSTAGRAM CAPTIONS ──────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `${ASCENTOR_BRAND}
Write 3 Instagram captions for Ascentor.

VOICE: ${voices.instagram}

${personaBlock}
Topic: "${topic}"
${nigerianBlock}
${hooksObj.instagram ? `Suggested hook: "${hooksObj.instagram}"` : ""}

REQUIREMENTS for all 3 captions:
- Caption 1 (RELATABLE PAIN POINT): 80-120 words. Open with a sentence that makes them stop scrolling — ideally a scenario they lived through. Reference something distinctly Nigerian. End with a question or "save this post".
- Caption 2 (QUICK TIP / CAROUSEL STYLE): 80-100 words. "3 things [audience] need to know about [topic]" style. Short punchy lines. End with: "Swipe for the full breakdown 👉" or similar.
- Caption 3 (BRAND CONFIDENCE): 60-80 words. Speak as Ascentor with pride. "At Ascentor, we built X because..." type of energy. Must be warm, not corporate.
- Each caption ends with 5-8 hashtags. Mix: #NigerianProfessionals #LagosCareer #AscentorNG #CareerGrowthNigeria + 2-3 topic-specific tags.

Return: { "captions": [ { "type": "pain_point|tip|brand", "caption": "text with \\n for line breaks", "hashtags": ["tag1","tag2"] } ] }`
        }]
      }),
      // ── EMAIL NEWSLETTER ────────────────────────────────────
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `${ASCENTOR_BRAND}
Write the weekly Ascentor newsletter: "The Career Edge" — for Nigerian professionals.

VOICE: ${voices.newsletter}

${personaBlock}
Topic: "${topic}"
${nigerianBlock}
${angleBlock}
${hooksObj.email ? `Subject line idea: "${hooksObj.email}"` : ""}
${dataBlock}

STRUCTURE (450-600 words total):
1. Subject line: curiosity + benefit + Nigeria signal (max 50 chars)
2. Preview text: makes them open it (max 90 chars)
3. Opening: 2-3 sentences — drop them into a real Nigerian professional scenario immediately
4. The Insight: the core lesson or truth (150-200 words) — use \\n for paragraphs
5. The Practical: 2-3 specific things they can do this week. Real actions, not vague advice.
6. Ascentor Moment: 2-3 sentences. Tell them what Sage AI or Ascentor circles can do for THIS specific problem. Tone: "we built this for exactly this moment" — confident and warm.
7. Sign-off: warm, mentor-style. Not "Best regards". More like how a real mentor ends a voice note.

Return: { "subject": "...", "preview_text": "90 chars max", "body": "full email with \\n breaks" }`
        }]
      })
    ]);
    let blog = {
      title: topic,
      content: "Draft pending review",
      meta_description: "",
      cta: ""
    };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        logger.info(`[Content Writer] Blog raw (first 300): ${raw.slice(0, 300)}`);
        blog = extractJSON(raw);
        logger.info(`[Content Writer] Blog ok — "${blog.title}"`);
      } catch (e) {
        logger.error(`[Content Writer] Blog parse failed: ${e}`);
      }
    } else {
      logger.error(`[Content Writer] Blog API error: ${blogSettled.reason}`);
    }
    let linkedinPosts = [];
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        logger.info(`[Content Writer] LinkedIn raw (first 300): ${raw.slice(0, 300)}`);
        const parsed = extractJSON(raw);
        linkedinPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Content Writer] LinkedIn ok — ${linkedinPosts.length} posts`);
      } catch (e) {
        logger.error(`[Content Writer] LinkedIn parse failed: ${e}`);
      }
    } else {
      logger.error(`[Content Writer] LinkedIn API error: ${linkedinSettled.reason}`);
    }
    let twitterThreads = [];
    if (twitterSettled.status === "fulfilled") {
      try {
        const raw = twitterSettled.value.content[0].type === "text" ? twitterSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        twitterThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
        logger.info(`[Content Writer] Twitter ok — ${twitterThreads.length} threads`);
      } catch (e) {
        logger.error(`[Content Writer] Twitter parse failed: ${e}`);
      }
    } else {
      logger.error(`[Content Writer] Twitter API error: ${twitterSettled.reason}`);
    }
    let instagramCaptions = [];
    if (instagramSettled.status === "fulfilled") {
      try {
        const raw = instagramSettled.value.content[0].type === "text" ? instagramSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        instagramCaptions = Array.isArray(parsed.captions) ? parsed.captions : [];
        logger.info(`[Content Writer] Instagram ok — ${instagramCaptions.length} captions`);
      } catch (e) {
        logger.error(`[Content Writer] Instagram parse failed: ${e}`);
      }
    } else {
      logger.error(`[Content Writer] Instagram API error: ${instagramSettled.reason}`);
    }
    let newsletter = {
      subject: `The Career Edge: ${topic}`,
      preview_text: "",
      body: ""
    };
    if (newsletterSettled.status === "fulfilled") {
      try {
        const raw = newsletterSettled.value.content[0].type === "text" ? newsletterSettled.value.content[0].text : "";
        newsletter = extractJSON(raw);
        logger.info(`[Content Writer] Newsletter ok — "${newsletter.subject}"`);
      } catch (e) {
        logger.error(`[Content Writer] Newsletter parse failed: ${e}`);
      }
    } else {
      logger.error(`[Content Writer] Newsletter API error: ${newsletterSettled.reason}`);
    }
    const items = [
      {
        pillar,
        week,
        status: "draft",
        platform: "Website",
        type: "Blog Post",
        title: (blog.title || topic).substring(0, 255),
        content_data: blog,
        audience
      },
      ...linkedinPosts.map((p, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "LinkedIn",
        type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`,
        content_data: p,
        audience
      })),
      ...twitterThreads.map((t, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "Twitter/X",
        type: "Twitter Thread",
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`,
        content_data: t,
        audience
      })),
      ...instagramCaptions.map((c, i) => ({
        pillar,
        week,
        status: "draft",
        platform: "Instagram",
        type: "Instagram Caption",
        title: `IG: ${(c.caption || `Caption ${i + 1}`).substring(0, 50)}...`,
        content_data: c,
        audience
      })),
      {
        pillar,
        week,
        status: "draft",
        platform: "Email",
        type: "Email Newsletter",
        title: (newsletter.subject || `The Career Edge: ${topic}`).substring(0, 255),
        content_data: newsletter,
        audience
      }
    ];
    let insertedCount = 0;
    for (const item of items) {
      const { error } = await supabase.from("content_calendar").insert(item);
      if (error) {
        logger.error(`[Content Writer] Insert failed "${item.title}": ${JSON.stringify(error)}`);
      } else {
        insertedCount++;
      }
    }
    logger.info(`[Content Writer] Saved ${insertedCount}/${items.length} rows`);
    const summary = {
      topic,
      pillar,
      week,
      audience,
      nigerianContext,
      generated: {
        blog: 1,
        linkedin_posts: linkedinPosts.length,
        twitter_threads: twitterThreads.length,
        instagram_captions: instagramCaptions.length,
        newsletter: 1
      },
      total_items: items.length,
      inserted: insertedCount
    };
    logger.info("[Content Writer] Done:", summary);
    return summary;
  }, "run")
});
export {
  contentWriterAgent
};
//# sourceMappingURL=content-writer.mjs.map
