import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as publicSchemas from '@/lib/validation/schemas/public';
import { limitPublic } from '@/lib/security';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const limited = await limitPublic(req, 'newsletter', 10, 600);
  if (limited) return limited;
  try {
    const parsed = await parseJson(req, publicSchemas.newsletterSubscribe);
    if (!parsed.ok) return parsed.response;
    const { email, firstName, source } = parsed.data;

    const resolvedSource = source || 'website';

    // 1. Save to Supabase (upsert - safe for duplicates from any source)
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[newsletter]", err);
    return NextResponse.json({ error: "Newsletter request failed" }, { status: 500 });
  }
}