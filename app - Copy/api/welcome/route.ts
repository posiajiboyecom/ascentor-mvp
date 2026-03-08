import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { addOrUpdateSubscriber, triggerAutomation, ML_GROUPS, ML_AUTOMATIONS } from "@/lib/mailerlite";

export async function POST(req: NextRequest) {
  try {
    const { email, name, userId } = await req.json();
    if (!email || !userId) {
      return NextResponse.json({ error: "Missing email or userId" }, { status: 400 });
    }

    // 1. Add to MailerLite as an app user + trigger nurture sequence
    try {
      await addOrUpdateSubscriber({
        email,
        firstName: name || email.split("@")[0],
        groups: [ML_GROUPS.APP_USERS, ML_GROUPS.FREE_USERS],
        fields: {
          source: "app_signup",
          user_id: userId,
          plan: "free",
        },
      });

      // Trigger the full 14-email welcome/nurture automation
      if (ML_AUTOMATIONS.WELCOME_SEQUENCE) {
        await triggerAutomation(email, ML_AUTOMATIONS.WELCOME_SEQUENCE);
      }
    } catch (mlError) {
      // Non-fatal — log and continue
      console.error("[welcome] MailerLite error (non-fatal):", mlError);
    }

    // 2. Also fire the Trigger.dev task (sends immediate transactional welcome via Resend)
    const handle = await tasks.trigger("send-welcome-email", {
      email,
      name: name || email.split("@")[0],
      userId,
    });

    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("[welcome] trigger failed:", error);
    return NextResponse.json({ error: "Email dispatch failed" }, { status: 500 });
  }
}