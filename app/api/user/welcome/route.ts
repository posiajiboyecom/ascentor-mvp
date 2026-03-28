import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { addOrUpdateSubscriber, triggerAutomation, ML_GROUPS, ML_AUTOMATIONS } from "@/lib/mailerlite";

export async function POST(req: NextRequest) {
  try {
    // Guard: only callable from within the app (payment/verify calls with service role)
    // Accept either an internal secret header OR a valid Supabase session
    const internalSecret = req.headers.get('x-internal-secret');
    // H-2 fix: explicitly reject empty string — env var must be set and non-empty
    const configuredSecret = process.env.INTERNAL_API_SECRET;
    const isInternal = !!(internalSecret && configuredSecret && internalSecret === configuredSecret);

    if (!isInternal) {
      // Fall back to session check for any other callers
      const { createClient: createAuthClient } = await import('@/lib/supabase/server');
      const authClient = await createAuthClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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