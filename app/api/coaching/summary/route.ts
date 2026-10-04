import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = await parseJson(req, memberSchemas.coachingSummary);
    if (!parsed.ok) return parsed.response;
    const { sessionId } = parsed.data;
    const handle = await tasks.trigger("process-coaching-summary", {
      sessionId,
      userId: user.id,
    });
    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("Coaching summary trigger failed:", error);
    console.error('[coaching]', error);
    return NextResponse.json({ error: 'Session summary failed' }, { status: 500 });
  }
}