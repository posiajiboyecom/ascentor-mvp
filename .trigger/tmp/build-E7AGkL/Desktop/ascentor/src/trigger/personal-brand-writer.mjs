import {
  Anthropic
} from "../../../../chunk-V4ZTZ3EU.mjs";
import {
  createClient,
  dist_exports
} from "../../../../chunk-IFXSHHCG.mjs";
import {
  task
} from "../../../../chunk-ZHF6YW46.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/personal-brand-writer.ts
init_esm();
var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
var POSI_VOICE = `
ABOUT POSI (the author):
- Cybersecurity professional — Security Analyst background
- Certifications: CompTIA Security+, Google Cybersecurity Professional, ISACA member
- Specialisations: Penetration Testing and GRC
- Currently building his personal brand to land a well-paying cybersecurity role
- Also founder of Ascentor (AI mentorship platform) — understands both technical and leadership dimensions
- Based in Lagos, Nigeria — but posts for a global professional audience

VOICE RULES:
1. Write from the perspective of someone who actually does this work — not someone who read about it
2. Be specific: name real tools (Burp Suite, Nmap, Metasploit, Cobalt Strike, Nuclei), real CVEs, real frameworks
3. Short paragraphs — 1-3 sentences maximum
4. Active voice. First person.
5. No openers: "Excited to share", "Hot take:", "Unpopular opinion:", "In today's digital landscape"
6. No closing phrases: "Hope this helps!", "Drop a comment!", "Let me know your thoughts!"
7. No emojis in technical posts. Maximum 1 emoji in career-signal posts.
8. No lists of 10 things. Maximum 3-4 numbered points if listing at all.
9. End LinkedIn posts with a genuine question or a clear single takeaway — not a call to action
10. Confidence without arrogance. Share knowledge generously.
`;
var INTENT_MODIFIERS = {
  authority: "This post should make a senior security engineer stop scrolling and think 'this person knows their stuff at a real practitioner level.' Demonstrate depth. Get technical. Be the person worth following.",
  career_signal: "This post signals to hiring managers and recruiters that Posi is actively practising and growing in cybersecurity — from a position of strength. Not 'I am looking for work.' Rather: 'Here is the work I am doing and thinking about.' The job-seeking intent is visible through demonstrated expertise, not stated.",
  inbound_magnet: "This post should make a hiring manager think 'we need someone who thinks like this' and DM Posi before he even applies. Be so specifically useful or insightful that it creates inbound interest. Rare expertise + communication clarity = inbound recruitment."
};
async function writeLinkedInPost(params) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 700,
    messages: [{
      role: "user",
      content: `${POSI_VOICE}

INTENT: ${INTENT_MODIFIERS[params.intent] || INTENT_MODIFIERS.authority}

TASK: Write ONE LinkedIn post about: "${params.topic}"

CONTENT PILLAR: ${params.pillar.replace(/_/g, " ")}
ANCHORED IN: ${params.recentReference}

USE THESE INPUTS (adapt, don't copy verbatim):
Opening hook: ${params.hook}
Key points to convey:
${params.keyPoints.map((p) => `- ${p}`).join("\n")}
Practitioner insight (the thing only someone doing this work knows): ${params.practitionerInsight}
Career angle: ${params.careerAngle}
Close with: ${params.callToAction}

LINKEDIN FORMAT:
- 150-280 words
- Hook on line 1 — stops the scroll (use the provided hook as a starting point, make it sharper)
- Blank line between each paragraph
- Maximum 3-4 numbered points if you use a list
- End with ONE question or takeaway — not a sales pitch
- 3-5 hashtags on the last line

Return ONLY the post. No explanation, no "Here is the post:".`
    }]
  });
  return response.content[0].text?.trim() || "";
}
__name(writeLinkedInPost, "writeLinkedInPost");
async function writeTwitterThread(params) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 900,
    messages: [{
      role: "user",
      content: `${POSI_VOICE}

INTENT: ${INTENT_MODIFIERS[params.intent] || INTENT_MODIFIERS.authority}

TASK: Write a Twitter/X thread (5-7 tweets) about: "${params.topic}"

CONTENT PILLAR: ${params.pillar.replace(/_/g, " ")}
ANCHORED IN: ${params.recentReference}

USE THESE INPUTS:
Thread hook: ${params.hook}
Key points:
${params.keyPoints.map((p) => `- ${p}`).join("\n")}
Practitioner insight: ${params.practitionerInsight}

TWITTER FORMAT:
- 5-7 tweets
- Number each: "1/" "2/" etc.
- Tweet 1: The hook — 240 chars max. Make it impossible to scroll past.
- Tweets 2-5: The substance — specific, technical, each one standalone valuable
- Tweet 6: The practitioner insight — the thing only someone doing this knows
- Final tweet: Takeaway + one question. Max 2 hashtags total in the whole thread.
- Blank line between each tweet
- No hashtags except optionally on the final tweet

Return ONLY the numbered tweets. No explanation.`
    }]
  });
  return response.content[0].text?.trim() || "";
}
__name(writeTwitterThread, "writeTwitterThread");
async function writeTwitterSingle(params) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `${POSI_VOICE}

TASK: Write ONE standalone tweet (not a thread) about "${params.topic}".

This is for high-frequency posting — a single sharp observation, fact, or question.
Reference: ${params.recentReference}
Pillar: ${params.pillar.replace(/_/g, " ")}

Rules:
- Max 240 characters
- Specific — reference a real tool, CVE, or concept
- No hashtags
- Ends with a question OR a sharp statement that invites replies
- Feels like something a practitioner just thought of, not polished marketing

Return ONLY the tweet. No explanation.`
    }]
  });
  return response.content[0].text?.trim() || "";
}
__name(writeTwitterSingle, "writeTwitterSingle");
async function savePost(params) {
  try {
    const { data, error } = await supabase.from("content_calendar").insert({
      title: params.title,
      type: params.type,
      platform: params.platform,
      pillar: "personal_brand",
      // distinct pillar — won't mix with Ascentor brand content
      week: params.weekNum,
      status: "draft",
      content_data: {
        ...params.content,
        contentType: params.type,
        intent: params.intent,
        pillar: params.pillar,
        briefId: params.briefId,
        isPersonalBrand: true
        // flag for UI filtering
      },
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }).select("id").single();
    if (error) {
      console.error("[PB-Writer] Save error:", error.message);
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.error("[PB-Writer] Save failed:", e.message);
    return null;
  }
}
__name(savePost, "savePost");
var personalBrandWriter = task({
  id: "personal-brand-writer",
  maxDuration: 120,
  run: /* @__PURE__ */ __name(async (payload) => {
    console.log(`[PB-Writer] Writing posts for: "${payload.topic}" — intent: ${payload.intent}`);
    const results = { errors: [] };
    try {
      const liText = await writeLinkedInPost({
        topic: payload.topic,
        pillar: payload.pillar,
        intent: payload.intent,
        hook: payload.hook_linkedin,
        keyPoints: payload.keyPoints,
        practitionerInsight: payload.practitionerInsight,
        careerAngle: payload.careerAngle,
        recentReference: payload.recentReference,
        callToAction: payload.callToAction
      });
      const liLines = liText.split("\n");
      const hashLine = liLines.findLast((l) => l.trim().startsWith("#")) || "";
      const liBody = liLines.filter((l) => l !== hashLine).join("\n").trim();
      const liId = await savePost({
        title: payload.topic,
        type: "LinkedIn Post",
        platform: "LinkedIn",
        pillar: payload.pillar,
        content: { body: liBody, hashtags: hashLine, hook: payload.hook_linkedin },
        weekNum: payload.weekNumber,
        briefId: payload.briefId,
        intent: payload.intent
      });
      results.linkedin = { id: liId, preview: liBody.slice(0, 100) };
      console.log(`[PB-Writer] LinkedIn post saved — id: ${liId}`);
    } catch (e) {
      console.error("[PB-Writer] LinkedIn failed:", e.message);
      results.errors.push(`LinkedIn: ${e.message}`);
    }
    try {
      const threadText = await writeTwitterThread({
        topic: payload.topic,
        pillar: payload.pillar,
        intent: payload.intent,
        hook: payload.hook_twitter,
        keyPoints: payload.keyPoints,
        practitionerInsight: payload.practitionerInsight,
        recentReference: payload.recentReference
      });
      const threadId = await savePost({
        title: `[Thread] ${payload.topic}`,
        type: "Twitter Thread",
        platform: "Twitter/X",
        pillar: payload.pillar,
        content: { body: threadText, hook: payload.hook_twitter },
        weekNum: payload.weekNumber,
        briefId: payload.briefId,
        intent: payload.intent
      });
      results.thread = { id: threadId, preview: threadText.slice(0, 100) };
      console.log(`[PB-Writer] Thread saved — id: ${threadId}`);
    } catch (e) {
      console.error("[PB-Writer] Thread failed:", e.message);
      results.errors.push(`Thread: ${e.message}`);
    }
    try {
      const singleText = await writeTwitterSingle({
        topic: payload.topic,
        pillar: payload.pillar,
        intent: payload.intent,
        linkedinHook: payload.hook_linkedin,
        recentReference: payload.recentReference
      });
      const singleId = await savePost({
        title: `[Tweet] ${payload.topic}`,
        type: "Twitter Single",
        platform: "Twitter/X",
        pillar: payload.pillar,
        content: { body: singleText },
        weekNum: payload.weekNumber,
        briefId: payload.briefId,
        intent: payload.intent
      });
      results.single = { id: singleId, preview: singleText.slice(0, 100) };
      console.log(`[PB-Writer] Single tweet saved — id: ${singleId}`);
    } catch (e) {
      console.error("[PB-Writer] Single tweet failed:", e.message);
      results.errors.push(`Single: ${e.message}`);
    }
    if (payload.briefId) {
      try {
        await supabase.from("personal_brand_briefs").update({ status: "written", written_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", payload.briefId);
      } catch {
      }
    }
    console.log(`[PB-Writer] Done — ${3 - results.errors.length}/3 posts saved`);
    return {
      success: results.errors.length < 3,
      topic: payload.topic,
      pillar: payload.pillar,
      intent: payload.intent,
      postsCreated: {
        linkedin: results.linkedin?.id || null,
        thread: results.thread?.id || null,
        single: results.single?.id || null
      },
      errors: results.errors
    };
  }, "run")
});
export {
  personalBrandWriter
};
//# sourceMappingURL=personal-brand-writer.mjs.map
