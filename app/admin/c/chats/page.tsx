// Community · Conversations. Reading needs View on "chats", exporting needs Full; both are checked again in the server actions.
import Conversations from '@/components/admin/console/Conversations';
import { requireArea } from '@/lib/admin/access';
import { can } from '@/lib/admin/areas';
import { listTab } from '@/lib/admin/conversations';
import { TABS, type TabKey } from '@/lib/admin/conversations-meta';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conversations' };

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireArea('chats', 'view');
  const { tab } = await searchParams;
  const initial: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : 'sage';
  let list: Awaited<ReturnType<typeof listTab>> = { rows: [] };
  let loadError: string | undefined;
  try { list = await listTab(initial); } catch (e) { console.error('[admin/chats] load failed:', e); loadError = 'We could not load these conversations. Try again in a moment.'; }
  return (
    <Conversations
      initialTab={initial}
      initialRows={list.rows}
      initialNote={list.note}
      loadError={loadError}
      canExport={can(staff.uiLevel('chats'), 'full')}
      canAnalyse={can(staff.uiLevel('analysis'), 'view')}
    />
  );
}
