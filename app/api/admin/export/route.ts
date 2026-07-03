// app/api/admin/export/route.ts
// ============================================================
// Admin data export — community_messages and coaching_sessions
// GET /api/admin/export
//   ?source=community|coaching|both   (required)
//   &format=csv|json|pdf              (required)
//   &from=2026-01-01                  (optional, ISO date, inclusive)
//   &to=2026-06-20                    (optional, ISO date, inclusive)
//
// Auth: same pattern as app/api/admin/community-messages/route.ts —
// Bearer token resolved against a request-scoped anon client, then
// role-checked via the service-role client. role === 'member' is
// rejected; admin and moderator both pass, matching every other
// /api/admin/* route in this codebase.
//
// PDF generation uses pdfkit (added to package.json — see note at
// bottom of this file) rather than a React-based PDF renderer,
// since this route has no JSX/bundler step and pdfkit streams
// directly to a Buffer without one.
//
// Row caps: community messages capped at 20,000 rows, coaching
// sessions at 10,000 rows per export, to keep response generation
// and PDF rendering inside a reasonable request lifetime. If a
// request hits the cap, `truncated: true` is included in the
// JSON format's metadata and a notice line is added to the PDF
// summary; CSV includes a trailing comment row. There's no UI
// for paginated/chunked exports yet — if exports start regularly
// hitting these caps, that's the next thing to build, not a
// silent data-loss risk today.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMMUNITY_ROW_CAP = 20_000;
const COACHING_ROW_CAP  = 10_000;

async function getAdminUser(authHeader: string | null) {
  if (!authHeader) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!profile || profile.role === 'member') return null;
  return { id: user.id, role: profile.role, name: profile.full_name as string | null };
}

type CommunityRow = {
  id: string; user_id: string; channel: string; content: string;
  created_at: string; deleted: boolean; pinned: boolean | null; flagged: boolean | null;
  author_name?: string | null; author_email?: string | null;
};

type CoachingRow = {
  id: string; user_id: string; session_type: string | null;
  user_input: string; ai_response: string; summary: string | null;
  token_usage: number | null; created_at: string;
  author_name?: string | null; author_email?: string | null;
};

async function fetchCommunity(from: string | null, to: string | null) {
  let q = supabaseAdmin
    .from('community_messages')
    .select('id,user_id,channel,content,created_at,deleted,pinned,flagged')
    .order('created_at', { ascending: true })
    .limit(COMMUNITY_ROW_CAP + 1);
  if (from) q = q.gte('created_at', from);
  if (to)   q = q.lte('created_at', to);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as CommunityRow[];

  // Hydrate author name/email in a single batched lookup rather than
  // N+1 queries — same approach as app/admin/community-intel/page.tsx
  // uses for its message list.
  const userIds = Array.from(new Set(rows.map(r => r.user_id)));
  if (userIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id, full_name, email').in('id', userIds);
    const byId = new Map((profiles || []).map(p => [p.id, p]));
    for (const r of rows) {
      const p = byId.get(r.user_id);
      r.author_name = p?.full_name ?? null;
      r.author_email = p?.email ?? null;
    }
  }

  const truncated = rows.length > COMMUNITY_ROW_CAP;
  return { rows: truncated ? rows.slice(0, COMMUNITY_ROW_CAP) : rows, truncated };
}

async function fetchCoaching(from: string | null, to: string | null) {
  let q = supabaseAdmin
    .from('coaching_sessions')
    .select('id,user_id,session_type,user_input,ai_response,summary,token_usage,created_at')
    .order('created_at', { ascending: true })
    .limit(COACHING_ROW_CAP + 1);
  if (from) q = q.gte('created_at', from);
  if (to)   q = q.lte('created_at', to);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as CoachingRow[];

  const userIds = Array.from(new Set(rows.map(r => r.user_id)));
  if (userIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id, full_name, email').in('id', userIds);
    const byId = new Map((profiles || []).map(p => [p.id, p]));
    for (const r of rows) {
      const p = byId.get(r.user_id);
      r.author_name = p?.full_name ?? null;
      r.author_email = p?.email ?? null;
    }
  }

  const truncated = rows.length > COACHING_ROW_CAP;
  return { rows: truncated ? rows.slice(0, COACHING_ROW_CAP) : rows, truncated };
}

// ── CSV ──────────────────────────────────────────────────────
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

// ── PDF ──────────────────────────────────────────────────────
function buildPdf(opts: {
  title: string;
  generatedBy: string;
  range: { from: string | null; to: string | null };
  sections: { heading: string; truncated: boolean; rowCount: number; lines: string[] }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#161412').text(opts.title);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#6B7280');
    doc.text(`Generated by ${opts.generatedBy} · ${new Date().toLocaleString('en-US')}`);
    const rangeLabel = opts.range.from || opts.range.to
      ? `Range: ${opts.range.from || 'start'} → ${opts.range.to || 'now'}`
      : 'Range: all time';
    doc.text(rangeLabel);
    doc.moveDown(1);
    doc.strokeColor('#E8E6E1').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    for (const section of opts.sections) {
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#161412').text(section.heading);
      doc.font('Helvetica').fontSize(9).fillColor('#A8894E')
        .text(`${section.rowCount} record${section.rowCount === 1 ? '' : 's'}${section.truncated ? ` — truncated at export cap` : ''}`);
      doc.moveDown(0.5);

      doc.font('Courier').fontSize(8).fillColor('#1F2937');
      for (const line of section.lines) {
        if (doc.y > 760) doc.addPage();
        doc.text(line, { width: 495 });
        doc.moveDown(0.25);
      }
      doc.moveDown(1);
    }

    doc.end();
  });
}

function summarizeCommunityForPdf(rows: CommunityRow[]): string[] {
  return rows.map(r => {
    const who = r.author_name || r.author_email || r.user_id.slice(0, 8);
    const flags = [r.deleted && 'deleted', r.pinned && 'pinned', r.flagged && 'flagged'].filter(Boolean);
    const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
    const body = r.content.replace(/\s+/g, ' ').slice(0, 160);
    return `${r.created_at}  #${r.channel}  ${who}${flagStr}: ${body}`;
  });
}

function summarizeCoachingForPdf(rows: CoachingRow[]): string[] {
  return rows.map(r => {
    const who = r.author_name || r.author_email || r.user_id.slice(0, 8);
    const summary = (r.summary || r.ai_response).replace(/\s+/g, ' ').slice(0, 160);
    return `${r.created_at}  ${who}  [${r.session_type || 'general'}]: ${summary}`;
  });
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req.headers.get('authorization'));
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source'); // community | coaching | both
    const format = searchParams.get('format'); // csv | json | pdf
    const from   = searchParams.get('from');   // ISO date, inclusive
    const to     = searchParams.get('to');     // ISO date, inclusive

    if (!source || !['community', 'coaching', 'both'].includes(source)) {
      return NextResponse.json({ error: 'source must be community, coaching, or both' }, { status: 400 });
    }
    if (!format || !['csv', 'json', 'pdf'].includes(format)) {
      return NextResponse.json({ error: 'format must be csv, json, or pdf' }, { status: 400 });
    }

    // Normalize date bounds: `to` should be end-of-day inclusive.
    const fromIso = from ? new Date(from + 'T00:00:00.000Z').toISOString() : null;
    const toIso   = to   ? new Date(to   + 'T23:59:59.999Z').toISOString() : null;

    const wantCommunity = source === 'community' || source === 'both';
    const wantCoaching  = source === 'coaching'  || source === 'both';

    const community = wantCommunity ? await fetchCommunity(fromIso, toIso) : null;
    const coaching  = wantCoaching  ? await fetchCoaching(fromIso, toIso)  : null;

    const stamp = new Date().toISOString().slice(0, 10);

    // ── JSON ──────────────────────────────────────────────────
    if (format === 'json') {
      const payload: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        exported_by: admin.name || admin.id,
        range: { from: fromIso, to: toIso },
      };
      if (community) payload.community_messages = { count: community.rows.length, truncated: community.truncated, rows: community.rows };
      if (coaching)  payload.coaching_sessions   = { count: coaching.rows.length,  truncated: coaching.truncated,  rows: coaching.rows };

      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="ascentor-export-${source}-${stamp}.json"`,
        },
      });
    }

    // ── CSV ───────────────────────────────────────────────────
    if (format === 'csv') {
      const parts: string[] = [];
      if (community) {
        parts.push(`# community_messages (${community.rows.length} rows${community.truncated ? ', TRUNCATED at export cap' : ''})`);
        parts.push(toCsv(
          ['id', 'created_at', 'channel', 'user_id', 'author_name', 'author_email', 'content', 'deleted', 'pinned', 'flagged'],
          community.rows as unknown as Record<string, unknown>[]
        ));
      }
      if (coaching) {
        if (parts.length) parts.push('');
        parts.push(`# coaching_sessions (${coaching.rows.length} rows${coaching.truncated ? ', TRUNCATED at export cap' : ''})`);
        parts.push(toCsv(
          ['id', 'created_at', 'user_id', 'author_name', 'author_email', 'session_type', 'user_input', 'ai_response', 'summary', 'token_usage'],
          coaching.rows as unknown as Record<string, unknown>[]
        ));
      }
      return new NextResponse(parts.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ascentor-export-${source}-${stamp}.csv"`,
        },
      });
    }

    // ── PDF ───────────────────────────────────────────────────
    const sections = [];
    if (community) {
      sections.push({
        heading: 'Community Messages',
        truncated: community.truncated,
        rowCount: community.rows.length,
        lines: summarizeCommunityForPdf(community.rows),
      });
    }
    if (coaching) {
      sections.push({
        heading: 'AI Coaching Sessions',
        truncated: coaching.truncated,
        rowCount: coaching.rows.length,
        lines: summarizeCoachingForPdf(coaching.rows),
      });
    }

    const pdfBuffer = await buildPdf({
      title: 'Ascentor — Chat Data Export',
      generatedBy: admin.name || admin.id,
      range: { from: fromIso, to: toIso },
      sections,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ascentor-export-${source}-${stamp}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[admin export]', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

// ============================================================
// SETUP REQUIRED — pdfkit is not yet in package.json.
// Run from project root:
//   npm install pdfkit
//   npm install --save-dev @types/pdfkit
// No other new dependencies were added — CSV and JSON formatting
// are hand-rolled in this file (no papaparse — that library is
// meant for client-side parsing, not server-side generation).
// ============================================================
