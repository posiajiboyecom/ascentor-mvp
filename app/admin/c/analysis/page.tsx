import AiAnalysis from '@/components/admin/console/AiAnalysis';
import { requireArea } from '@/lib/admin/access';
import { aiConfigured, latestPlatformSummaries, SOURCES, type Source } from '@/lib/admin/analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: 'AI analysis' };

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ q?: string; narrow?: string; src?: string }> }) {
  const staff = await requireArea('analysis', 'view');
  const sp = await searchParams;
  const summaries = [...(await latestPlatformSummaries()).values()];
  const src = (SOURCES as readonly string[]).includes(sp.src ?? '') ? (sp.src as Source) : null;
  return (
    <AiAnalysis
      configured={aiConfigured()}
      canExport={staff.uiLevel('analysis') === 'full'}
      canSeeRecs={staff.uiLevel('recs') !== 'none'}
      initialQuestion={(sp.q ?? '').slice(0, 500)}
      initialNarrow={(sp.narrow ?? '').slice(0, 80)}
      initialSource={src}
      summaries={summaries}
    />
  );
}
