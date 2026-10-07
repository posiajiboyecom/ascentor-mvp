// app/admin/chats/page.tsx
// Admin chat library: Circle chats, group rooms, direct messages, Sage conversations and a per-member view.
// Admins only. Opening or exporting a chat is logged. Members agree to this at signup.

import Link from 'next/link';
import '@/styles/rx.css';
import { Search } from 'lucide-react';
import { requireAdmin } from '@/lib/rx/admin';
import { findMembers, listCircleChats, listDmChats, listGroupChats, listSageChats, type ChatListItem } from '@/lib/rx/chats';
import { relTime } from '@/lib/rx/dates';
import { Aside, Title } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

const TABS: { key: string; label: string }[] = [
  { key: 'circle', label: 'Circles' }, { key: 'group', label: 'Groups' }, { key: 'dm', label: 'Direct messages' },
  { key: 'sage', label: 'Sage' }, { key: 'member', label: 'By member' },
];

export default async function AdminChatsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Chats are available to admins only.</p></div></div>; }
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : 'circle';
  const q = (sp.q ?? '').trim();

  let items: ChatListItem[] = [];
  let members: { id: string; name: string; email: string | null }[] = [];
  if (tab === 'circle') items = await listCircleChats();
  else if (tab === 'group') items = await listGroupChats();
  else if (tab === 'dm') items = await listDmChats(q);
  else if (tab === 'sage') items = await listSageChats(q);
  else members = q ? await findMembers(q) : [];

  const searchable = tab === 'dm' || tab === 'sage' || tab === 'member';

  return (
    <div className="rx" style={{ padding: 4 }}>
      <p className="rx-sm">Community</p>
      <Title>Chats</Title>
      <div className="rx-opts" style={{ marginBottom: 20 }} role="tablist" aria-label="Chat type">
        {TABS.map((t) => <Link key={t.key} href={`/admin/chats?tab=${t.key}`} className={`rx-opt${tab === t.key ? ' on' : ''}`}>{t.label}</Link>)}
      </div>
      <div className="rx-two">
        <div className="rx-stack">
          {searchable && (
            <form method="get" className="rx-row rx-nw" style={{ gap: 8 }}>
              <input type="hidden" name="tab" value={tab} />
              <label className="rx-in" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-muted)' }} />
                <input name="q" defaultValue={q} placeholder={tab === 'member' ? 'Search a member by name or email' : 'Filter by member name or email'} aria-label="Search" style={{ border: 0, outline: 0, background: 'none', flex: 1, height: 44, fontSize: 16, fontFamily: 'inherit' }} />
              </label>
              <button type="submit" className="rx-btn secondary">Search</button>
            </form>
          )}

          {tab === 'member' && !q && <p className="rx-sm">Search for a member to open or download everything they have written or received: Circle, groups, direct messages and Sage.</p>}
          {tab === 'member' && members.map((m) => (
            <Link key={m.id} href={`/admin/chats/view?scope=member&id=${m.id}`} className="rx-rowlink"><span className="rt"><span className="t">{m.name}</span><span className="m">{m.email ?? ''}</span></span></Link>
          ))}
          {tab === 'member' && q && members.length === 0 && <p className="rx-sm">No member matches that.</p>}

          {tab !== 'member' && (
            <div className="rx-card" style={{ padding: '4px 16px' }}>
              {items.map((it) => (
                <Link key={it.id} href={`/admin/chats/view?scope=${tab}&id=${it.id}`} className="rx-rowlink">
                  <span className="rt"><span className="t">{it.title}</span><span className="m">{it.subtitle}</span></span>
                  <span className="rx-sm">{it.at ? relTime(it.at) : 'No messages'}</span>
                </Link>
              ))}
              {items.length === 0 && <p className="rx-sm" style={{ padding: '14px 4px' }}>{tab === 'sage' ? 'No Sage conversations are stored yet. They are saved from now on.' : 'Nothing here yet.'}</p>}
            </div>
          )}
        </div>
        <Aside>
          <p className="rx-label">About this page</p>
          <p className="rx-p">Open any chat to read it, or download it as a PDF or a text file. You can limit a download to a date range.</p>
          <p className="rx-sm">Members agree at signup that the Ascentor team can read chats for safety and to improve Ascentor. Every view and download is recorded.</p>
          <Link href="/admin/chats/log" className="rx-link">See the access log</Link>
        </Aside>
      </div>
    </div>
  );
}
