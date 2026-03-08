import {
  sendPushToUser
} from "../../../../chunk-F7BI2CNV.mjs";
import {
  coachingSummaryEmail
} from "../../../../chunk-XMG42UWX.mjs";
import {
  Resend
} from "../../../../chunk-4NS42XCJ.mjs";
import {
  Anthropic
} from "../../../../chunk-V4ZTZ3EU.mjs";
import {
  createClient,
  dist_exports
} from "../../../../chunk-IFXSHHCG.mjs";
import {
  task
} from "../../../../chunk-MN3LL5E3.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/coaching-summary.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
var processCoachingSummary = task({
  id: "process-coaching-summary",
  run: /* @__PURE__ */ __name(async (payload) => {
    const { sessionId, userId } = payload;
    const { data: session } = await supabase.from("coaching_sessions").select("*").eq("id", sessionId).single();
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
    if (!profile?.email) {
      console.log("No email for user, skipping summary email");
      return { success: true, skipped: true };
    }
    const messages = session.messages || [];
    if (messages.length < 8) {
      console.log("Session too short for summary");
      return { success: true, skipped: true, reason: "too_short" };
    }
    const conversationText = messages.map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`).join("\n\n");
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `You are summarizing a leadership coaching session for the user. Be concise and actionable.

Conversation:
${conversationText}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence overview of what was discussed",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "nextSteps": ["action 1", "action 2"],
  "goals": ["any goals mentioned or committed to"]
}`
        }
      ]
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      console.error("Failed to parse Claude response:", text);
      parsed = {
        summary: "Your coaching session covered important leadership topics.",
        keyTakeaways: [],
        nextSteps: [],
        goals: []
      };
    }
    await supabase.from("coaching_sessions").update({
      summary: parsed.summary,
      key_takeaways: parsed.keyTakeaways,
      next_steps: parsed.nextSteps,
      goals: parsed.goals
    }).eq("id", sessionId);
    const template = coachingSummaryEmail(
      profile.full_name || "there",
      parsed.summary,
      parsed.keyTakeaways,
      parsed.nextSteps
    );
    await resend.emails.send({
      from: "Ascentor <hello@ascentorbi.com>",
      to: profile.email,
      subject: template.subject,
      html: template.html
    });
    console.log(`Summary sent to ${profile.email} for session ${sessionId}`);
    try {
      await sendPushToUser(supabase, userId, {
        title: "✨ Your coaching summary is ready",
        body: "Sage has captured your key takeaways and next steps.",
        url: "/coach",
        tag: "coaching-summary",
        icon: "/icons/icon-192.png"
      });
    } catch {
    }
    return {
      success: true,
      summary: parsed.summary,
      takeaways: parsed.keyTakeaways.length,
      steps: parsed.nextSteps.length
    };
  }, "run")
});
export {
  processCoachingSummary
};
//# sourceMappingURL=coaching-summary.mjs.map
