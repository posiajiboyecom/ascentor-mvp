import { task } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { coachingSummaryEmail } from "./emails/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const processCoachingSummary = task({
  id: "process-coaching-summary",
  run: async (payload: { sessionId: string; userId: string }) => {
    const { sessionId, userId } = payload;

    // Get session messages
    const { data: session } = await supabase
      .from("coaching_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    if (!profile?.email) {
      console.log("No email for user, skipping summary email");
      return { success: true, skipped: true };
    }

    // Get conversation messages
    const messages = session.messages || [];
    if (messages.length < 4) {
      console.log("Session too short for summary");
      return { success: true, skipped: true, reason: "too_short" };
    }

    // Build conversation text for Claude
    const conversationText = messages
      .map((m: any) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
      .join("\n\n");

    // Ask Claude to summarize
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
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
}`,
        },
      ],
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
        goals: [],
      };
    }

    // Save summary to DB
    await supabase
      .from("coaching_sessions")
      .update({
        summary: parsed.summary,
        key_takeaways: parsed.keyTakeaways,
        next_steps: parsed.nextSteps,
        goals: parsed.goals,
      })
      .eq("id", sessionId);

    // Send summary email
    const template = coachingSummaryEmail(
      profile.full_name || "there",
      parsed.summary,
      parsed.keyTakeaways,
      parsed.nextSteps
    );

    await resend.emails.send({
      from: "Ascentor Coach <coach@ascentor.co>",
      to: profile.email,
      subject: template.subject,
      html: template.html,
    });

    console.log(`Summary sent to ${profile.email} for session ${sessionId}`);

    return {
      success: true,
      summary: parsed.summary,
      takeaways: parsed.keyTakeaways.length,
      steps: parsed.nextSteps.length,
    };
  },
});
