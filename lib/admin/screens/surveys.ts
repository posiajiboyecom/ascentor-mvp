// lib/admin/screens/surveys.ts
// Spec copied from the admin prototype (Insights · Surveys). Rows: the three private growth-survey waves (aggregate counts only,
// staff never see individual answers) and the admin-built surveys (public.surveys / survey_responses).
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ActionResult, ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "surveys",
  group: "Insights",
  title: "Surveys",
  sub: "The baseline survey at signup and follow-ups at 3 and 6 months.",
  cols: [
    "Survey",
    "Responses",
    "Average time",
    "Willing to pay",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "close",
      label: "Close",
      col: 4,
      to: "Ended"
    },
    {
      id: "reopen",
      label: "Reopen",
      col: 4,
      to: "Live"
    }
  ],
  buttons: [
    {
      id: "new-survey",
      label: "New survey",
      href: "/admin/surveys"
    }
  ]
};

const WAVES: { id: string; label: string }[] = [
  { id: 'baseline', label: 'Baseline (signup)' },
  { id: 'm3', label: '3-month check' },
  { id: 'm6', label: '6-month check' },
];

const n = (v: number) => v.toLocaleString('en-NG');
const mins = (secs: number) => (secs < 90 ? '1 min' : `${Math.round(secs / 60)} min`);

interface SurveyRow { id: string; title: string; is_published: boolean; questions: { id?: string }[] | null }
interface RespRow { survey_id: string; answers: Record<string, unknown> | null; metadata: { duration_seconds?: number } | null }

async function waveCounts(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const { data } = await supabaseAdmin.from('private_growth_scores').select('kind');
    for (const r of (data ?? []) as { kind: string }[]) out.set(r.kind, (out.get(r.kind) ?? 0) + 1);
  } catch { /* table missing: zero */ }
  return out;
}

const screen: ScreenModule = {
  spec,
  async load() {
    const [{ data: surveys, error }, { data: resp }, waves] = await Promise.all([
      supabaseAdmin.from('surveys').select('id, title, is_published, questions').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('survey_responses').select('survey_id, answers, metadata').limit(20000),
      waveCounts(),
    ]);
    if (error) throw error;
    const byId = new Map<string, RespRow[]>();
    for (const r of (resp ?? []) as RespRow[]) {
      const a = byId.get(r.survey_id) ?? [];
      a.push(r);
      byId.set(r.survey_id, a);
    }
    const rows = WAVES.map((w) => {
      const c = waves.get(w.id) ?? 0;
      return { id: `wave:${w.id}`, cells: [w.label, n(c), '-', '-', c > 0 ? 'Live' : 'Scheduled'] };
    });
    for (const s of (surveys ?? []) as SurveyRow[]) {
      const rs = byId.get(s.id) ?? [];
      const durs = rs.map((r) => r.metadata?.duration_seconds).filter((d): d is number => typeof d === 'number');
      const avg = durs.length ? mins(durs.reduce((a, b) => a + b, 0) / durs.length) : '-';
      // Willing to pay: share of responses to the pricing question (id q8) that did not answer "Nothing".
      const hasQ8 = (s.questions ?? []).some((q) => q.id === 'q8');
      let wtp = '-';
      if (hasQ8 && rs.length) {
        const paying = rs.filter((r) => {
          const a = r.answers?.q8;
          return typeof a === 'string' && a.trim() !== '' && !a.toLowerCase().startsWith('nothing');
        }).length;
        wtp = `${Math.round((paying / rs.length) * 100)}%`;
      }
      rows.push({ id: s.id, cells: [s.title, n(rs.length), avg, wtp, s.is_published ? 'Live' : 'Ended'] });
    }
    return { rows, note: 'The three growth-survey waves show response counts only; members’ answers stay private.' };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (rowId.startsWith('wave:')) return { ok: false, error: 'The growth surveys run on each member’s own schedule and cannot be closed here.' };
    if (actionId !== 'close' && actionId !== 'reopen') return { ok: false, error: 'Unknown action.' };
    const { data: cur } = await supabaseAdmin.from('surveys').select('id, is_published').eq('id', rowId).maybeSingle();
    if (!cur) return { ok: false, error: 'That survey no longer exists.' };
    const want = actionId === 'reopen';
    if (!!cur.is_published === want) return { ok: false, error: want ? 'It is already live.' : 'It is already closed.' };
    const { error } = await supabaseAdmin.from('surveys').update({ is_published: want, updated_at: new Date().toISOString() }).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update that survey. Please try again.' };
    return { ok: true };
  },
};

export default screen;
