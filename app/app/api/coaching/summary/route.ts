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
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const handle = await tasks.trigger("process-coaching-summary", {
      sessionId,
      userId: user.id,
    });
    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("Coaching summary trigger failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}