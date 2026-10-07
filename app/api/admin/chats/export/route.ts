// app/api/admin/chats/export/route.ts
// GET ?scope=circle|group|dm|sage|member&id=<uuid>&format=pdf|txt[&from=YYYY-MM-DD&to=YYYY-MM-DD]
// Admin only. Builds the file in memory, logs the export, and streams it back. Members consent to chat review at signup.

import { NextResponse } from 'next/server';
import { getMe } from '@/lib/rx/server';
import { getTranscripts, logAccess, type ChatScope } from '@/lib/rx/chats';
import { toPdf, toText } from '@/lib/rx/chat-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPES: ChatScope[] = ['circle', 'group', 'dm', 'sage', 'member'];
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const me = await getMe();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const u = new URL(req.url);
  const scope = u.searchParams.get('scope') as ChatScope;
  const id = u.searchParams.get('id') ?? '';
  const format = u.searchParams.get('format') === 'txt' ? 'txt' : 'pdf';
  const from = u.searchParams.get('from') ?? undefined;
  const to = u.searchParams.get('to') ?? undefined;
  if (!SCOPES.includes(scope) || !UUID.test(id)) return NextResponse.json({ error: 'Choose a chat to export.' }, { status: 400 });
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return NextResponse.json({ error: 'Dates must look like 2026-10-31.' }, { status: 400 });

  const transcripts = await getTranscripts(scope, id, from, to);
  if (!transcripts.length) return NextResponse.json({ error: 'That chat was not found.' }, { status: 404 });

  const total = transcripts.reduce((n, t) => n + t.lines.length, 0);
  await logAccess(me.userId, 'export', scope, id, format, { from: from ?? null, to: to ?? null, messages: total });

  const meta = { exportedBy: me.fullName, exportedAt: new Date().toISOString(), from, to };
  const base = `ascentor-chat-${scope}-${(transcripts[0].title || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'txt') {
    return new NextResponse(toText(transcripts, meta), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.txt"`, 'Cache-Control': 'no-store' } });
  }
  const pdf = await toPdf(transcripts, meta);
  return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${base}.pdf"`, 'Cache-Control': 'no-store' } });
}
