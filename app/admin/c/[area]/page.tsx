// The generic console list screen: /admin/c/<area>. Bespoke screens (team, chats, plans, platform, recs, analysis) have their own
// folders next to this one and take precedence. The area's access level is checked here AND again in every server action.
import { notFound } from 'next/navigation';
import ListScreen from '@/components/admin/console/ListScreen';
import { requireArea } from '@/lib/admin/access';
import { getScreen } from '@/lib/admin/screens';
import { areaOf } from '@/lib/admin/areas';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  return { title: areaOf(area)?.label ?? 'Admin' };
}

export default async function AreaPage({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { area } = await params;
  const { filter } = await searchParams;
  const screen = await getScreen(area);
  if (!screen) notFound();

  const staff = await requireArea(area, 'view');
  let data: Awaited<ReturnType<typeof screen.load>> = { rows: [] };
  let loadError: string | undefined;
  try {
    data = await screen.load(staff);
  } catch (e) {
    console.error(`[admin/${area}] load failed:`, e);
    loadError = 'We could not load this screen. Try again in a moment.';
  }

  return <ListScreen spec={screen.spec} rows={data.rows} kpis={data.kpis} note={data.note} level={staff.uiLevel(area)} initialFilter={filter} loadError={loadError} />;
}
