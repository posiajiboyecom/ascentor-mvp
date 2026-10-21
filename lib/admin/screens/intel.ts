// lib/admin/screens/intel.ts
// Spec copied from the admin prototype (Insights · Platform intel). Run analysis reads real platform counts, asks the same
// Anthropic model the existing intel route uses, and saves the summary (platform_snapshots, generated_by "console:<id>").
// Summaries are read on the AI analysis screen. A row is only "Ready" once a run really finished.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLATFORM_ANALYSES, runPlatformAnalysis } from '@/lib/admin/analysis';
import type { ActionResult, ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "intel",
  group: "Insights",
  title: "Platform intel",
  sub: "AI summaries of how the platform is doing. Run one, or ask your own question.",
  cols: [
    "Analysis",
    "Covers",
    "Last run",
    "Status"
  ],
  statusCol: 3,
  actions: [
    {
      id: "run-analysis",
      label: "Run analysis",
      done: "Analysis ready. Open it to read the summary.",
      keep: true
    }
  ],
  quick: 0,
  ask: true
};

const TZ = 'Africa/Lagos';
const when = (iso: string) => {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: TZ });
  if (day(d) === day(new Date())) return 'Today';
  if (day(d) === day(new Date(Date.now() - 864e5))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
};

const screen: ScreenModule = {
  spec,
  async load() {
    const last = new Map<string, string>();
    try {
      const { data } = await supabaseAdmin.from('platform_snapshots').select('generated_at, generated_by').like('generated_by', 'console:%').order('generated_at', { ascending: false }).limit(100);
      for (const r of (data ?? []) as { generated_at: string; generated_by: string }[]) {
        const id = r.generated_by.slice('console:'.length);
        if (!last.has(id)) last.set(id, r.generated_at);
      }
    } catch { /* no runs yet */ }
    return {
      rows: PLATFORM_ANALYSES.map((a) => ({ id: a.id, cells: [a.label, a.covers, last.has(a.id) ? when(last.get(a.id)!) : 'Not run', last.has(a.id) ? 'Ready' : 'Pending'] })),
      note: 'Each run reads live platform counts and saves a summary. Read the summaries on AI analysis, under Platform summaries.',
    };
  },
  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'run-analysis') return { ok: false, error: 'Unknown action.' };
    const r = await runPlatformAnalysis(rowId);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
};

export default screen;
