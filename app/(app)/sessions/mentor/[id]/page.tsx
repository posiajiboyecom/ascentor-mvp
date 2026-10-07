import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { freeSlots, suggestMentors } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, Avatar, BackLink, Page, Tag } from '@/components/rx/ui';
import { RequestTasterButton } from '@/components/rx/sessions/SessionsClient';

export const dynamic = 'force-dynamic';

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const { data: m } = await db.from('human_mentors').select('id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting').eq('id', id).eq('active', true).maybeSingle();
  if (!m) notFound();
  const [slots, suggested, { count: load }] = await Promise.all([
    freeSlots(db, [id]),
    suggestMentors(),
    db.from('mentor_matches').select('id', { count: 'exact', head: true }).eq('mentor_id', id).in('status', ['accepted', 'active']),
  ]);
  const next = (slots.get(id) ?? [])[0] ?? null;
  const why = suggested.find((x) => x.id === id)?.why;
  const full = (load ?? 0) >= (m.capacity as number);

  return (
    <Page>
      <BackLink href="/sessions/suggestions">Suggestions</BackLink>
      <div className="rx-two" style={{ marginTop: 8 }}>
        <div className="rx-stack">
          <div className="rx-row rx-nw" style={{ gap: 16, alignItems: 'flex-end' }}>
            <Avatar name={m.name as string} url={m.avatar_url as string | null} size="lg" seed={id} />
            <div style={{ minWidth: 0 }}><h1 className="rx-title">{m.name as string}</h1><p className="rx-sm">{m.headline as string}</p></div>
          </div>
          <span className="rx-rule" style={{ margin: 0 }} />
          <div className="rx-row" style={{ gap: 6 }}>{(m.tags as string[]).map((t) => <Tag key={t}>{t}</Tag>)}</div>
          {m.bio ? <p className="rx-p" style={{ whiteSpace: 'pre-line' }}>{m.bio as string}</p> : <p className="rx-sm">This mentor hasn’t added a bio yet.</p>}
          {why && <p className="rx-sm">Why suggested: {why}</p>}
          <div className="rx-row">
            <RequestTasterButton mentorId={id} slotId={next?.id ?? null} primary label="Request a taster" />
            <Link href={`/sessions/book/${id}`} className="rx-btn secondary">See times</Link>
          </div>
        </div>
        <Aside>
          <p className="rx-label">Details</p>
          <div className="rx-between"><span>Languages</span><span>{(m.langs as string[]).join(', ')}</span></div>
          <div className="rx-between"><span>Format</span><span>{(m.formats as string[]).join(' or ')}</span></div>
          <div className="rx-between"><span>Next slot</span><span>{next ? whenLabel(next.starts_at, me.tz) : 'On request'}</span></div>
          <div className="rx-between"><span>Capacity</span><span>{full ? 'Full' : 'Open'}</span></div>
        </Aside>
      </div>
    </Page>
  );
}
