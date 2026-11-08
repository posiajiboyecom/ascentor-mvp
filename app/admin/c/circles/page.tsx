// Admin → Circles: every Circle and everything about it. Takes precedence over the generic /admin/c/[area] list.
// The level is checked here to draw and again in every action.
import CirclesConsole from '@/components/admin/community/CirclesConsole';
import { requireArea } from '@/lib/admin/access';
import { can } from '@/lib/admin/areas';
import { loadCircles } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Circles' };

export default async function CirclesPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const staff = await requireArea('circles', 'view');
  const { id } = await searchParams;
  const r = await loadCircles();
  const lv = (need: 'edit' | 'full') => can(staff.uiLevel('circles'), need) && can(staff.level('circles'), need);
  return (
    <CirclesConsole
      initial={r.ok ? r.overview : null}
      loadError={r.ok ? undefined : r.error}
      canEdit={lv('edit')}
      canFull={lv('full')}
      initialId={id && /^[0-9a-f-]{36}$/i.test(id) ? id : null}
    />
  );
}
