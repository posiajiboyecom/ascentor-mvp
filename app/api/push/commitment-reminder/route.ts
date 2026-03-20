// app/api/push/commitment-reminder/route.ts
// Called daily by a cron job to remind users of commitments due today.
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notify, NotifyTemplates } from '@/lib/notify';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Find all commitments due today (not yet completed)
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data: commitments } = await service
    .from('user_commitments')
    .select('user_id, commitment_text')
    .eq('completed', false)
    .gte('due_date', start)
    .lt('due_date', end);

  if (!commitments?.length) return NextResponse.json({ ok: true, notified: 0 });

  await Promise.allSettled(
    commitments.map(c =>
      notify(c.user_id, NotifyTemplates.sageCommitmentDue(c.commitment_text))
    )
  );

  return NextResponse.json({ ok: true, notified: commitments.length });
}
