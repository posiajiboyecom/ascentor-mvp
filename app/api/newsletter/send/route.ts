import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";
import type { sendNewsletter } from "@/trigger/send-newsletter";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { subject, content } = await req.json();

    if (!subject || !content) {
      return NextResponse.json({ error: "Subject and content required" }, { status: 400 });
    }

    const handle = await tasks.trigger<typeof sendNewsletter>("send-newsletter", {
      subject,
      content,
      sentBy: user.email || user.id,
    });

    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("Newsletter trigger failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
