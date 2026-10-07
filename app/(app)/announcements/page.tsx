// app/(app)/announcements/page.tsx
// News and events from the Ascentor team, in one place. Hiding the banner on Today removes nothing from here.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getMemberAnnouncements, type AnnouncementView } from '@/lib/rx/announcements';
import { Aside, GoLink, Page } from '@/components/rx/ui';
import { AnnouncementList, Earlier, FocusCard, MarkAllButton, MarkReadOnView, type AnnItem } from '@/components/rx/announcements/AnnouncementsClient';

export const dynamic = 'force-dynamic';

const toItem = (a: AnnouncementView): AnnItem => ({ id: a.id, title: a.title, text: a.text ?? '', posted: a.posted, isNew: a.effective === 'Live' && !a.isRead, ended: a.effective === 'Ended' });

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const all = await getMemberAnnouncements();
  const live = all.filter((a) => a.effective === 'Live');
  const ended = all.filter((a) => a.effective === 'Ended');
  const focus = all.find((a) => a.id === sp.focus) ?? live.find((a) => a.featured) ?? live[0] ?? null;
  const rest = live.filter((a) => !focus || a.id !== focus.id);
  const unread = live.some((a) => !a.isRead);
  const when = focus ? [focus.date_label ? focus.date_label + (focus.time_label ? `, ${focus.time_label}` : '') : ''].filter(Boolean)[0] ?? '' : '';

  return (
    <Page>
      <div className="rx-between" style={{ alignItems: 'flex-end' }}>
        <h1 className="rx-title">Announcements</h1>
        {unread && <MarkAllButton />}
      </div>
      <span className="rx-rule" />
      <div className="rx-two">
        <div className="rx-stack-lg">
          {!focus ? (
            <div className="rx-card rx-empty"><p className="rx-h3">Nothing new right now.</p><Link href="/dashboard" className="rx-btn secondary">Back to Today</Link></div>
          ) : (
            <>
              <FocusCard
                label={focus.effective === 'Ended' ? 'Ended' : focus.featured ? 'Featured' : 'Announcement'}
                title={focus.title} text={focus.text ?? ''} when={when} location={focus.location ?? ''}
                btn={focus.btn_label ?? ''} link={focus.link ?? ''} ended={focus.effective === 'Ended'} image={focus.image_url}
              />
              <MarkReadOnView id={focus.effective === 'Live' && !focus.isRead ? focus.id : null} />
              {rest.length > 0 && <div className="rx-stack-sm"><p className="rx-label">Latest</p><AnnouncementList items={rest.map(toItem)} /></div>}
              <Earlier items={ended.filter((a) => a.id !== focus.id).map(toItem)} />
            </>
          )}
        </div>
        <Aside>
          <p className="rx-label">From the Ascentor team</p>
          <p className="rx-p">News and events, in one place. Hiding the banner on Today doesn’t remove anything here.</p>
          <GoLink href="/settings">Mute announcement notifications</GoLink>
        </Aside>
      </div>
    </Page>
  );
}
