// GET /api/rx/chat/poll?kind=circle|dm|group&id=<uuid>&after=<ISO>
// New messages for an open chat. A plain route (not a server action), so a chat left open across a deploy keeps
// working: server action ids change with every deploy, and an old page could no longer call them until refreshed.
// Reads go through the member's own session, so the database's row rules decide what they may see.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { circleMessages } from '@/lib/rx/circle';
import { dmMessages } from '@/lib/rx/messages';
import { groupMessages } from '@/lib/rx/community';
import { featureBlock } from '@/lib/access';
import type { ChatMsg } from '@/lib/rx/chat-types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Two messages can commit out of order. Re-reading a short overlap and de-duplicating by id in the browser means a
// message that commits a moment late is never skipped.
const OVERLAP_MS = 15_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind');
  const id = sp.get('id') ?? '';
  const afterRaw = sp.get('after');
  if (!UUID.test(id) || (kind !== 'circle' && kind !== 'dm' && kind !== 'group')) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  let after: string | null = null;
  if (afterRaw) {
    const t = Date.parse(afterRaw);
    if (Number.isNaN(t)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    after = new Date(t - OVERLAP_MS).toISOString();
  }

  let messages: ChatMsg[];
  if (kind === 'circle') {
    if (await featureBlock(user.id, 'circleChat')) messages = [];
    else messages = await circleMessages(db, id, after);
  } else if (kind === 'dm') messages = await dmMessages(db, id, after);
  else messages = await groupMessages(db, id, after);

  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
}
