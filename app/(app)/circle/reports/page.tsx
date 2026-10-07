import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { circleReports } from '@/lib/rx/circle';
import { Aside, Avatar, BackLink, Page, Title } from '@/components/rx/ui';
import { ReportForm } from '@/components/rx/circle/CircleClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const circle = await getMyCircle();
  if (!circle || !circle.pledged) redirect('/circle');
  if (!circle.week) {
    return (
      <Page>
        <BackLink href="/circle">Circle</BackLink>
        <Title>Weekly reports</Title>
        <div className="rx-card rx-empty"><p className="rx-p">Reports open when your first meeting is set, once 6 members have joined.</p></div>
      </Page>
    );
  }
  const db = await createClient();
  const reports = await circleReports(db, circle.circle.id, circle.week, me.userId);
  const mine = reports.find((r) => r.isMe);

  return (
    <Page>
      <BackLink href="/circle">Circle</BackLink>
      <Title>Weekly reports</Title>
      <div className="rx-two">
        <ReportForm week={circle.week} shared={!!mine} initial={{ kept: mine?.kept ?? '', obstacle: mine?.obstacle ?? '', next: mine?.next ?? '' }} />
        <Aside>
          <p className="rx-label">From your Circle</p>
          {reports.length === 0 && <p className="rx-sm">No reports shared yet this week.</p>}
          {reports.map((r) => (
            <div key={r.userId} className="rx-stack-sm" style={{ paddingBottom: 14, borderBottom: '1px solid var(--rx-border)' }}>
              <div className="rx-row rx-nw" style={{ gap: 10 }}>
                <Avatar name={r.name} url={r.avatarUrl} seed={r.userId} />
                <span className="rx-strong" style={{ flex: 1 }}>{r.name}</span>
                <span className="rx-sm" style={{ whiteSpace: 'nowrap' }}>{r.kept}</span>
              </div>
              {r.obstacle && <p className="rx-sm">Obstacle: {r.obstacle}</p>}
              {r.next && <p className="rx-sm">Next: {r.next}</p>}
            </div>
          ))}
        </Aside>
      </div>
    </Page>
  );
}
