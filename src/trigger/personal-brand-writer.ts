// ═══════════════════════════════════════════════════════════════════════════
// Personal Brand Writer — Posi Ajiboye Samuel
//
// Triggered by: personal-brand-researcher (automatic) or manual UI trigger
//
// Produces per run:
//   1 × LinkedIn long-form post  (150-300 words, practitioner voice)
//   1 × Twitter/X thread         (5-7 tweets, technical depth)
//   1 × Twitter/X single tweet   (hook-only for high-frequency posting)
//
// VOICE RULES (non-negotiable):
//   - Practitioner, not commentator. Write from doing, not from reading.
//   - Direct and specific. No vague generalisations.
//   - Zero corporate speak, zero buzzword soup.
//   - When technical — be genuinely technical. Naming tools, CVEs, frameworks.
//   - When career-focused — strength, not desperation.
//   - First person, active voice, short paragraphs.
//
// CYBERSECURITY CONTENT MIX (inherited from researcher):
//   70% Penetration Testing & Offensive Security
//   30% GRC (Governance, Risk, Compliance)
// ═══════════════════════════════════════════════════════════════════════════

import { task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Posi's full voice brief — injected into every write prompt ────────────
const POSI_VOICE = `
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

// ── Intent-specific voice modifiers ──────────────────────────────────────
const INTENT_MODIFIERS: Record<string, string> = {
  authority:
    "This post should make a senior security engineer stop scrolling and think "
    + "'this person knows their stuff at a real practitioner level.' "
    + "Demonstrate depth. Get technical. Be the person worth following.",

  career_signal:
    "This post signals to hiring managers and recruiters that Posi is actively "
    + "practising and growing in cybersecurity — from a position of strength. "
    + "Not 'I am looking for work.' Rather: 'Here is the work I am doing and thinking about.' "
    + "The job-seeking intent is visible through demonstrated expertise, not stated.",

  inbound_magnet:
    "This post should make a hiring manager think 'we need someone who thinks like this' "
    + "and DM Posi before he even applies. "
    + "Be so specifically useful or insightful that it creates inbound interest. "
    + "Rare expertise + communication clarity = inbound recruitment.",
};

// ── LinkedIn post writer ──────────────────────────────────────────────────
async function writeLinkedInPost(params: {
  topic:               string;
  pillar:              string;
  intent:              string;
  hook:                string;
  keyPoints:           string[];
  practitionerInsight: string;
  careerAngle:         string;
  recentReference:     string;
  callToAction:        string;
}): Promise<string> {

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 700,
    messages: [{
      role:    "user",
      content:
        `${POSI_VOICE}\n\n`
        + `INTENT: ${INTENT_MODIFIERS[params.intent] || INTENT_MODIFIERS.authority}\n\n`
        + `TASK: Write ONE LinkedIn post about: "${params.topic}"\n\n`
        + `CONTENT PILLAR: ${params.pillar.replace(/_/g, " ")}\n`
        + `ANCHORED IN: ${params.recentReference}\n\n`
        + `USE THESE INPUTS (adapt, don't copy verbatim):\n`
        + `Opening hook: ${params.hook}\n`
        + `Key points to convey:\n${params.keyPoints.map(p => `- ${p}`).join("\n")}\n`
        + `Practitioner insight (the thing only someone doing this work knows): ${params.practitionerInsight}\n`
        + `Career angle: ${params.careerAngle}\n`
        + `Close with: ${params.callToAction}\n\n`
        + `LINKEDIN FORMAT:\n`
        + `- 150-280 words\n`
        + `- Hook on line 1 — stops the scroll (use the provided hook as a starting point, make it sharper)\n`
        + `- Blank line between each paragraph\n`
        + `- Maximum 3-4 numbered points if you use a list\n`
        + `- End with ONE question or takeaway — not a sales pitch\n`
        + `- 3-5 hashtags on the last line\n\n`
        + `Return ONLY the post. No explanation, no "Here is the post:".`,
    }],
  });

  return (response.content[0] as any).text?.trim() || "";
}

// ── Twitter thread writer ─────────────────────────────────────────────────
async function writeTwitterThread(params: {
  topic:               string;
  pillar:              string;
  intent:              string;
  hook:                string;
  keyPoints:           string[];
  practitionerInsight: string;
  recentReference:     string;
}): Promise<string> {

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 900,
    messages: [{
      role:    "user",
      content:
        `${POSI_VOICE}\n\n`
        + `INTENT: ${INTENT_MODIFIERS[params.intent] || INTENT_MODIFIERS.authority}\n\n`
        + `TASK: Write a Twitter/X thread (5-7 tweets) about: "${params.topic}"\n\n`
        + `CONTENT PILLAR: ${params.pillar.replace(/_/g, " ")}\n`
        + `ANCHORED IN: ${params.recentReference}\n\n`
        + `USE THESE INPUTS:\n`
        + `Thread hook: ${params.hook}\n`
        + `Key points:\n${params.keyPoints.map(p => `- ${p}`).join("\n")}\n`
        + `Practitioner insight: ${params.practitionerInsight}\n\n`
        + `TWITTER FORMAT:\n`
        + `- 5-7 tweets\n`
        + `- Number each: "1/" "2/" etc.\n`
        + `- Tweet 1: The hook — 240 chars max. Make it impossible to scroll past.\n`
        + `- Tweets 2-5: The substance — specific, technical, each one standalone valuable\n`
        + `- Tweet 6: The practitioner insight — the thing only someone doing this knows\n`
        + `- Final tweet: Takeaway + one question. Max 2 hashtags total in the whole thread.\n`
        + `- Blank line between each tweet\n`
        + `- No hashtags except optionally on the final tweet\n\n`
        + `Return ONLY the numbered tweets. No explanation.`,
    }],
  });

  return (response.content[0] as any).text?.trim() || "";
}

// ── Twitter single tweet writer ───────────────────────────────────────────
async function writeTwitterSingle(params: {
  topic:           string;
  pillar:          string;
  intent:          string;
  linkedinHook:    string;
  recentReference: string;
}): Promise<string> {

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{
      role:    "user",
      content:
        `${POSI_VOICE}\n\n`
        + `TASK: Write ONE standalone tweet (not a thread) about "${params.topic}".\n\n`
        + `This is for high-frequency posting — a single sharp observation, fact, or question.\n`
        + `Reference: ${params.recentReference}\n`
        + `Pillar: ${params.pillar.replace(/_/g, " ")}\n\n`
        + `Rules:\n`
        + `- Max 240 characters\n`
        + `- Specific — reference a real tool, CVE, or concept\n`
        + `- No hashtags\n`
        + `- Ends with a question OR a sharp statement that invites replies\n`
        + `- Feels like something a practitioner just thought of, not polished marketing\n\n`
        + `Return ONLY the tweet. No explanation.`,
    }],
  });

  return (response.content[0] as any).text?.trim() || "";
}

// ── Save posts to content_calendar (same table as Ascentor brand content) ─
async function savePost(params: {
  title:    string;
  type:     "LinkedIn Post" | "Twitter Thread" | "Twitter Single";
  platform: string;
  pillar:   string;
  content:  any;
  weekNum:  number;
  briefId:  string | null;
  intent:   string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("content_calendar")
      .insert({
        title:          params.title,
        type:           params.type,
        platform:       params.platform,
        pillar:         "personal_brand",  // distinct pillar — won't mix with Ascentor brand content
        week:           params.weekNum,
        status:         "draft",
        content_data: {
          ...params.content,
          contentType: params.type,
          intent:      params.intent,
          pillar:      params.pillar,
          briefId:     params.briefId,
          isPersonalBrand: true,          // flag for UI filtering
        },
        created_at: new Date().toISOString(),
      })
      .select("id").single();

    if (error) {
      console.error("[PB-Writer] Save error:", error.message);
      return null;
    }
    return data?.id || null;
  } catch (e: any) {
    console.error("[PB-Writer] Save failed:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TASK
// ═══════════════════════════════════════════════════════════════════════════
export const personalBrandWriter = task({
  id:          "personal-brand-writer",
  maxDuration: 120,
  run: async (payload: {
    topic:               string;
    pillar:              string;
    intent:              string;
    weekNumber:          number;
    briefId:             string | null;
    hook_linkedin:       string;
    hook_twitter:        string;
    keyPoints:           string[];
    practitionerInsight: string;
    careerAngle:         string;
    recentReference:     string;
    callToAction:        string;
    triggeredBy?:        string;
  }) => {
    console.log(`[PB-Writer] Writing posts for: "${payload.topic}" — intent: ${payload.intent}`);

    const results: {
      linkedin?: { id: string | null; preview: string };
      thread?:   { id: string | null; preview: string };
      single?:   { id: string | null; preview: string };
      errors:    string[];
    } = { errors: [] };

    // ── LinkedIn ──────────────────────────────────────────────────────────
    try {
      const liText = await writeLinkedInPost({
        topic:               payload.topic,
        pillar:              payload.pillar,
        intent:              payload.intent,
        hook:                payload.hook_linkedin,
        keyPoints:           payload.keyPoints,
        practitionerInsight: payload.practitionerInsight,
        careerAngle:         payload.careerAngle,
        recentReference:     payload.recentReference,
        callToAction:        payload.callToAction,
      });

      // Split hashtags from body for clean display
      const liLines  = liText.split("\n");
      const hashLine = liLines.findLast((l: string) => l.trim().startsWith("#")) || "";
      const liBody   = liLines.filter((l: string) => l !== hashLine).join("\n").trim();

      const liId = await savePost({
        title:    payload.topic,
        type:     "LinkedIn Post",
        platform: "LinkedIn",
        pillar:   payload.pillar,
        content:  { body: liBody, hashtags: hashLine, hook: payload.hook_linkedin },
        weekNum:  payload.weekNumber,
        briefId:  payload.briefId,
        intent:   payload.intent,
      });

      results.linkedin = { id: liId, preview: liBody.slice(0, 100) };
      console.log(`[PB-Writer] LinkedIn post saved — id: ${liId}`);
    } catch (e: any) {
      console.error("[PB-Writer] LinkedIn failed:", e.message);
      results.errors.push(`LinkedIn: ${e.message}`);
    }

    // ── Twitter thread ────────────────────────────────────────────────────
    try {
      const threadText = await writeTwitterThread({
        topic:               payload.topic,
        pillar:              payload.pillar,
        intent:              payload.intent,
        hook:                payload.hook_twitter,
        keyPoints:           payload.keyPoints,
        practitionerInsight: payload.practitionerInsight,
        recentReference:     payload.recentReference,
      });

      const threadId = await savePost({
        title:    `[Thread] ${payload.topic}`,
        type:     "Twitter Thread",
        platform: "Twitter/X",
        pillar:   payload.pillar,
        content:  { body: threadText, hook: payload.hook_twitter },
        weekNum:  payload.weekNumber,
        briefId:  payload.briefId,
        intent:   payload.intent,
      });

      results.thread = { id: threadId, preview: threadText.slice(0, 100) };
      console.log(`[PB-Writer] Thread saved — id: ${threadId}`);
    } catch (e: any) {
      console.error("[PB-Writer] Thread failed:", e.message);
      results.errors.push(`Thread: ${e.message}`);
    }

    // ── Twitter single ────────────────────────────────────────────────────
    try {
      const singleText = await writeTwitterSingle({
        topic:           payload.topic,
        pillar:          payload.pillar,
        intent:          payload.intent,
        linkedinHook:    payload.hook_linkedin,
        recentReference: payload.recentReference,
      });

      const singleId = await savePost({
        title:    `[Tweet] ${payload.topic}`,
        type:     "Twitter Single",
        platform: "Twitter/X",
        pillar:   payload.pillar,
        content:  { body: singleText },
        weekNum:  payload.weekNumber,
        briefId:  payload.briefId,
        intent:   payload.intent,
      });

      results.single = { id: singleId, preview: singleText.slice(0, 100) };
      console.log(`[PB-Writer] Single tweet saved — id: ${singleId}`);
    } catch (e: any) {
      console.error("[PB-Writer] Single tweet failed:", e.message);
      results.errors.push(`Single: ${e.message}`);
    }

    // ── Update brief status ───────────────────────────────────────────────
    if (payload.briefId) {
      try {
        await supabase
          .from("personal_brand_briefs")
          .update({ status: "written", written_at: new Date().toISOString() })
          .eq("id", payload.briefId);
      } catch { /* non-fatal */ }
    }

    console.log(`[PB-Writer] Done — ${3 - results.errors.length}/3 posts saved`);

    return {
      success:      results.errors.length < 3,
      topic:        payload.topic,
      pillar:       payload.pillar,
      intent:       payload.intent,
      postsCreated: {
        linkedin: results.linkedin?.id || null,
        thread:   results.thread?.id   || null,
        single:   results.single?.id   || null,
      },
      errors: results.errors,
    };
  },
});
