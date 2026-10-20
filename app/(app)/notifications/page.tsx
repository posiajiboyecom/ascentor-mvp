import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { localISODate, addDays, relTime } from '@/lib/rx/dates';
import { Aside, Page } from '@/components/rx/ui';
import { MarkAllButton, NotifItem, type NotifRow } from '@/components/rx/pages/NotificationsClient';
import EmptyLamp from '@/components/rx/pages/EmptyLamp';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

interface Row { id: string; title: string | null; message: string | null; link: string | null; read: boolean | null; actor_id: string | null; created_at: string }

/** Only in-app paths; anything else is dropped. */
const safePath = (l: string | null) => (l && l.startsWith('/') && !l.startsWith('//') ? l : null);

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!me) redirect('/login');
  const { tab } = await searchParams;
  const onlyUnread = tab === 'unread';
  const db = await createClient();

  const { data } = await db.from('notifications').select('id, title, message, link, read, actor_id, created_at').eq('user_id', me.userId).order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: people } = actorIds.length ? await db.from('member_directory').select('id, full_name').in('id', actorIds) : { data: [] };
  const nameOf = new Map(((people ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));

  const unreadCount = rows.filter((r) => !r.read).length;
  const weekAgo = addDays(me.today, -6);
  const buckets: { title: string; items: NotifRow[] }[] = [{ title: 'Today', items: [] }, { title: 'This week', items: [] }, { title: 'Earlier', items: [] }];
  for (const r of rows) {
    if (onlyUnread && r.read) continue;
    const day = localISODate(me.tz, new Date(r.created_at));
    const b = day === me.today ? 0 : day >= weekAgo ? 1 : 2;
    const text = [r.title, r.message].filter(Boolean).join(' ').trim() || 'New notification';
    buckets[b].items.push({ id: r.id, text, time: relTime(r.created_at), unread: !r.read, href: safePath(r.link), actorName: r.actor_id ? nameOf.get(r.actor_id) ?? null : null, actorId: r.actor_id });
  }
  const groups = buckets.filter((g) => g.items.length);

  return (
    <Page>
      <div className="rx-between" style={{ alignItems: 'flex-end' }}>
        <h1 className="rx-title">Notifications</h1>
        {unreadCount > 0 && <MarkAllButton />}
      </div>
      <span className="rx-rule" />
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-opts">
            <Link href="/notifications" replace scroll={false} className={`rx-opt${onlyUnread ? '' : ' on'}`}>All</Link>
            <Link href="/notifications?tab=unread" replace scroll={false} className={`rx-opt${onlyUnread ? ' on' : ''}`}>Unread</Link>
          </div>
          {groups.length === 0 && (
            <div className="rx-card rx-empty">
              <EmptyLamp />
              <p className="rx-h3">You’re all caught up.</p>
              <p className="rx-sm">Replies, reminders and invites show up here.</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.title} className="rx-stack-sm">
              <p className="rx-label">{g.title}</p>
              <div className="rx-card" style={{ padding: '4px 12px' }}>
                {g.items.map((n) => <NotifItem key={n.id} n={n} />)}
              </div>
            </div>
          ))}
        </div>
        <Aside>
          <p className="rx-label">What you hear about</p>
          <p className="rx-p">Choose which reminders reach you, and set quiet hours.</p>
          <div><Link href="/settings?tab=alerts" className="rx-link">Alert settings<ArrowRight aria-hidden /></Link></div>
        </Aside>
      </div>
    </Page>
  );
}
