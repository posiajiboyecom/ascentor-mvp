import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const handle = await tasks.trigger("send-newsletter", {
      subject,
      content,
      sentBy: user.email || user.id,
    });
    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("Newsletter trigger failed:", error);
    console.error('[newsletter]', error);
    return NextResponse.json({ error: 'Newsletter send failed' }, { status: 500 });
  }
}