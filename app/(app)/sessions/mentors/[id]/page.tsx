import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/rx/server';
import { freeSlots } from '@/lib/rx/mentors';
import { whenLabel } from '@/lib/rx/dates';
import { Aside, Avatar, BackLink, Page, Tag } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const { data: m } = await db.from('human_mentors').select('id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting').eq('id', id).eq('active', true).maybeSingle();
  if (!m) notFound();
  const slots = await freeSlots(db, [id]);
  const next = (slots.get(id) ?? [])[0] ?? null;

  return (
    <Page>
      <BackLink href="/sessions">Sessions</BackLink>
      <div className="rx-two" style={{ marginTop: 8 }}>
        <div className="rx-stack">
          <div className="rx-row rx-nw" style={{ gap: 16, alignItems: 'flex-end' }}>
            <Avatar name={m.name as string} url={m.avatar_url as string | null} size="lg" seed={id} />
            <div style={{ minWidth: 0 }}><h1 className="rx-title">{m.name as string}</h1><p className="rx-sm">{m.headline as string}</p></div>
          </div>
          <span className="rx-rule" style={{ margin: 0 }} />
          <div className="rx-row" style={{ gap: 6 }}>{(m.tags as string[]).map((t) => <Tag key={t}>{t}</Tag>)}</div>
          {m.bio ? <p className="rx-p" style={{ whiteSpace: 'pre-line' }}>{m.bio as string}</p> : <p className="rx-sm">This mentor hasn’t added a bio yet.</p>}
          <p className="rx-sm">Your Circle votes for its mentor from the Sessions page.</p>
        </div>
        <Aside>
          <p className="rx-label">Details</p>
          <div className="rx-between"><span>Languages</span><span>{(m.langs as string[]).join(', ')}</span></div>
          <div className="rx-between"><span>Format</span><span>Audio · 20 minutes</span></div>
          <div className="rx-between"><span>Next open time</span><span>{next ? whenLabel(next.starts_at, me.tz) : 'Not published yet'}</span></div>
        </Aside>
      </div>
    </Page>
  );
}
