import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Settings as SettingsIcon, TrendingUp, UserRound, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { getMentorship } from '@/lib/rx/cmentor';
import { Aside, Avatar, Page, Tag } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const [circle, ms, { data: wins }] = await Promise.all([
    getMyCircle(), getMentorship().catch(() => null),
    db.from('feed_posts').select('id, body').eq('user_id', me.userId).eq('type', 'Win').eq('deleted', false).order('created_at', { ascending: false }).limit(3),
  ]);
  const st = ms?.state;
  const mentorLine = !st || st.kind === 'none' ? 'Your Circle chooses one together'
    : st.kind === 'active' || st.kind === 'paused' ? st.mentor.name
    : st.kind === 'requested' || st.kind === 'scheduling' ? `Your Circle chose ${st.mentor.name.split(' ')[0]}`
    : st.kind === 'voting' || st.kind === 'tie' ? 'Your Circle is voting' : 'Your Circle chooses one together';
  const p = me.profile;
  const row = (href: string, icon: React.ReactNode, title: string, meta: string) => (
    <Link href={href} className="rx-rowlink"><span className="ri">{icon}</span><span className="rt"><span className="t">{title}</span><span className="m">{meta}</span></span><ChevronRight aria-hidden /></Link>
  );

  return (
    <Page>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-row rx-nw" style={{ gap: 16 }}>
            <Avatar name={me.fullName} url={me.avatarUrl} size="lg" seed={me.userId} />
            <div style={{ minWidth: 0 }}>
              <h1 className="rx-title">{me.fullName}</h1>
              <div className="rx-row" style={{ gap: 6, marginTop: 6 }}>{p?.stage && <Tag>{p.stage}</Tag>}{p?.city && <Tag>{p.city}</Tag>}</div>
            </div>
          </div>
          <span className="rx-rule" style={{ margin: 0 }} />
          <div className="rx-card" style={{ padding: '4px 16px' }}>
            {row('/growth', <TrendingUp aria-hidden />, 'My Growth', 'Private results over time')}
            {row('/circle', <Users aria-hidden />, 'My Circle', circle ? `${circle.circle.name} · Circle ${circle.circle.number}` : 'Not placed yet')}
            {row('/sessions', <UserRound aria-hidden />, 'My mentor', mentorLine)}
            {row('/settings', <SettingsIcon aria-hidden />, 'Settings', 'Account, profile, security, plan, alerts')}
            {row('/account', <UserRound aria-hidden />, 'Account and billing', 'Name, email, sign-in and plan')}
          </div>
        </div>
        <Aside>
          <p className="rx-label">Interests</p>
          <div className="rx-row" style={{ gap: 6 }}>{p?.interests?.length ? p.interests.map((t) => <Tag key={t}>{t}</Tag>) : <span className="rx-sm">None chosen yet.</span>}</div>
          <p className="rx-label">Wins shared publicly</p>
          {(wins ?? []).length ? (wins as { id: string; body: string }[]).map((w) => <p key={w.id} className="rx-p">{w.body}</p>) : <p className="rx-sm">Nothing shared yet. Wins you post appear here.</p>}
        </Aside>
      </div>
    </Page>
  );
}
