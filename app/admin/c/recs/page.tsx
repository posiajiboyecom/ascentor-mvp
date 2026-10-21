import Recommendations from '@/components/admin/console/Recommendations';
import { requireArea } from '@/lib/admin/access';
import { getRecommendations, REC_TYPES } from '@/lib/admin/recommendations';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recommendations' };

export default async function RecsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const staff = await requireArea('recs', 'view');
  const { type } = await searchParams;
  const data = await getRecommendations();
  const lvl = staff.uiLevel('recs');
  return (
    <Recommendations
      recs={data.recs}
      state={data.state}
      stateAvailable={data.stateAvailable}
      canEdit={lvl === 'edit' || lvl === 'full'}
      canExport={lvl === 'full'}
      canAnalyse={staff.uiLevel('analysis') !== 'none'}
      initialType={(REC_TYPES as readonly string[]).includes(type ?? '') ? type! : 'All'}
    />
  );
}
