import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

export async function POST(req: NextRequest) {
  try {
    // Guard: only callable from within the app (payment/verify calls with service role)
    // Accept either an internal secret header OR a valid Supabase session
    const internalSecret = req.headers.get('x-internal-secret');
    // H-2 fix: explicitly reject empty string - env var must be set and non-empty
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

    const parsed = await parseJson(req, memberSchemas.userWelcome);
    if (!parsed.ok) return parsed.response;
    const { email, name, userId } = parsed.data;

    // Send the welcome email (Trigger.dev task, sent via Resend).
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