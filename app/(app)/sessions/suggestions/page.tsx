import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GoLink, Avatar, BackLink, Page, SageLine, Tag, Title } from '@/components/rx/ui';
import { getMe } from '@/lib/rx/server';
import { suggestMentors } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import { RequestTasterButton } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function SuggestionsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const mentors = await suggestMentors();

  return (
    <Page>
      <BackLink href="/sessions/intake">Edit what I want</BackLink>
      <Title>Suggested mentors</Title>
      <div style={{ margin: '-6px 0 20px' }}><SageLine>{mentors.length ? `${mentors.length === 1 ? 'One person who fits' : `${mentors.length} people who fit`} your goal.` : 'No match yet.'}</SageLine></div>
      {mentors.length === 0 ? (
        <div className="rx-card rx-empty">
          <p className="rx-p">No mentors are taking new requests right now. Check back soon, or join a live expert session in the meantime.</p>
          <div className="rx-row"><Link href="/experts" className="rx-btn secondary">Live expert sessions</Link></div>
        </div>
      ) : (
        <div className="rx-grid3">
          {mentors.map((m, i) => (
            <div key={m.id} className="rx-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="rx-thumb" style={{ borderRadius: '12px 12px 0 0', aspectRatio: 'auto', height: 150, alignItems: 'center', justifyContent: 'center' }}><Avatar name={m.name} url={m.avatar_url} size="lg" seed={m.id} /></div>
              <div className="rx-stack-sm" style={{ padding: '16px 18px 18px', flex: 1 }}>
                <div><p className="rx-h3">{m.name}</p><p className="rx-sm">{m.headline}</p></div>
                <div className="rx-row" style={{ gap: 6 }}>{m.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}</div>
                <p className="rx-sm">{m.langs.join(', ')}{m.nextSlot ? ` · next ${whenLabel(m.nextSlot.starts_at, me.tz)}` : ''}</p>
                <p className="rx-sm">{m.why}</p>
                <div className="rx-row" style={{ marginTop: 'auto' }}>
                  <RequestTasterButton mentorId={m.id} slotId={m.nextSlot?.id ?? null} primary={i === 0} />
                  <GoLink href={`/sessions/mentor/${m.id}`}>Profile</GoLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
