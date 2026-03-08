import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addOrUpdateSubscriber, triggerAutomation, ML_GROUPS, ML_AUTOMATIONS } from "@/lib/mailerlite";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, firstName } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // 1. Save to Supabase (source of truth)
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email: email.trim().toLowerCase(),
      first_name: firstName || null,
      source: "website",
      is_active: true,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: true, message: "Already subscribed" });
      }
      console.error("[newsletter] Supabase error:", error);
      return NextResponse.json({ error: "Newsletter request failed" }, { status: 500 });
    }

    // 2. Add to MailerLite — non-blocking (failure doesn't break response)
    try {
      await addOrUpdateSubscriber({
        email,
        firstName: firstName || undefined,
        groups: [ML_GROUPS.NEWSLETTER],
        fields: { source: "newsletter_signup" },
      });

      // Trigger the 14-email nurture sequence if automation ID is configured
      if (ML_AUTOMATIONS.WELCOME_SEQUENCE) {
        await triggerAutomation(email, ML_AUTOMATIONS.WELCOME_SEQUENCE);
      }
    } catch (mlError) {
      console.error("[newsletter] MailerLite error (non-fatal):", mlError);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[newsletter]", err);
    return NextResponse.json({ error: "Newsletter request failed" }, { status: 500 });
  }
}