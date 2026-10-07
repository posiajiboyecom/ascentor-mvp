import Link from 'next/link';
import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { adminGroups, computeSuggestions, requireAdmin } from '@/lib/rx/admin';
import { GroupsTable, SuggestionCards } from '@/components/rx/admin/GroupsAdmin';
import { Aside, Title } from '@/components/rx/ui';
import { Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminGroupsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Group management is for admins.</p></div></div>; }
  const tab = sp.tab === 'groups' ? 'groups' : 'suggestions';
  const [suggestions, groups] = await Promise.all([tab === 'suggestions' ? computeSuggestions() : Promise.resolve([]), tab === 'groups' ? adminGroups() : Promise.resolve([])]);

  return (
    <ToastProvider>
      <div className="rx rx-admin-desktop" style={{ padding: 4 }}>
        <p className="rx-sm">Community</p>
        <Title>{tab === 'groups' ? 'Created groups' : 'Group suggestions'}</Title>
        <div className="rx-opts" style={{ marginBottom: 24 }} role="tablist" aria-label="Groups">
          <Link href="/admin/groups" className={`rx-opt${tab === 'suggestions' ? ' on' : ''}`}>Group suggestions</Link>
          <Link href="/admin/groups?tab=groups" className={`rx-opt${tab === 'groups' ? ' on' : ''}`}>Created groups</Link>
        </div>
        <div className="rx-two">
          {tab === 'suggestions' ? (
            <>
              <div className="rx-stack">
                <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><Lock aria-hidden style={{ width: 16, height: 16 }} />Built from onboarding choices, post tags and group requests only. Never from Sage conversations or survey answers.</p>
                <SuggestionCards items={suggestions} />
              </div>
              <Aside>
                <p className="rx-label">This list updates live</p>
                <p className="rx-p">{suggestions.length} {suggestions.length === 1 ? 'suggestion' : 'suggestions'} from member signals.</p>
                <p className="rx-sm">Creating a group adds it quietly to every member’s directory and shows it first to members who fit. Dismissing changes nothing for members.</p>
              </Aside>
            </>
          ) : (
            <>
              <GroupsTable rows={groups} />
              <Aside>
                <p className="rx-label">Quiet groups</p>
                <p className="rx-p">Groups with fewer than 5 posts in 7 days are flagged. Merge them into a close group or archive them.</p>
                <p className="rx-sm">Members of an archived group keep their messages and get a note pointing to an active group.</p>
              </Aside>
            </>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
