import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";

export async function POST(req: NextRequest) {
  try {
    const { email, name, userId } = await req.json();
    if (!email || !userId) {
      return NextResponse.json({ error: "Missing email or userId" }, { status: 400 });
    }
    const handle = await tasks.trigger("send-welcome-email", {
      email,
      name: name || email.split("@")[0],
      userId,
    });
    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("Welcome email trigger failed:", error);
    console.error('[welcome]', error);
    return NextResponse.json({ error: 'Email dispatch failed' }, { status: 500 });
  }
}