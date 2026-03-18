import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addOrUpdateSubscriber, triggerAutomation, ML_GROUPS, ML_AUTOMATIONS } from "@/lib/mailerlite";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, firstName, source } = body;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const resolvedSource = source || 'website';

    // 1. Save to Supabase (upsert — safe for duplicates from any source)
    const { error } = await supabase.from("newsletter_subscribers").upsert({
      email: email.trim().toLowerCase(),
      first_name: firstName || null,
      source: resolvedSource,
      is_active: true,
      subscribed_at: new Date().toISOString(),
    }, { onConflict: 'email', ignoreDuplicates: false });

    if (error && error.code !== "23505") {
      console.error("[newsletter] Supabase error:", error);
      return NextResponse.json({ error: "Newsletter request failed" }, { status: 500 });
    }

    // 2. Add to MailerLite — non-blocking (failure doesn't break response)
    try {
      await addOrUpdateSubscriber({
        email,
        firstName: firstName || undefined,
        groups: [ML_GROUPS.NEWSLETTER].filter(Boolean),
        fields: { source: resolvedSource },
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