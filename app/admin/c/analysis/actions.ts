'use server';

import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { cleanResult, runAnalysis as run, SOURCES, toMarkdown, type AnalysisInput, type AnalysisResult, type Source } from '@/lib/admin/analysis';

export interface AnalysisResponse { ok: boolean; error?: string; result?: AnalysisResult; download?: { filename: string; mime: string; content: string } }
const AREA = 'AI analysis';

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisResponse> {
  try {
    const staff = await staffForAction();
    staff.require('analysis', 'view');
    const clean: AnalysisInput = {
      sources: (Array.isArray(input?.sources) ? input.sources : []).filter((s): s is Source => (SOURCES as readonly string[]).includes(s)),
      range: String(input?.range ?? ''),
      narrow: String(input?.narrow ?? '').slice(0, 80),
      question: String(input?.question ?? '').slice(0, 500),
      anonymise: input?.anonymise !== false,
    };
    const r = await run(clean, staff.userId);
    if (!r.ok) return { ok: false, error: r.error };
    await auditAdmin(staff, 'Ran analysis', clean.question, AREA);
    return { ok: true, result: r.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work. Please try again.' };
  }
}

/** Export as Markdown. Needs Full access; the browser's copy of the result is re-checked before it becomes a file. */
export async function exportAnalysis(raw: AnalysisResult): Promise<AnalysisResponse> {
  try {
    const staff = await staffForAction();
    staff.require('analysis', 'full');
    const r = cleanResult(raw);
    if (!r) return { ok: false, error: 'There is no analysis to export.' };
    await auditAdmin(staff, 'Exported (Markdown)', r.question, 'Exports');
    return { ok: true, download: { filename: 'ai-analysis.md', mime: 'text/markdown;charset=utf-8', content: toMarkdown(r) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work. Please try again.' };
  }
}
