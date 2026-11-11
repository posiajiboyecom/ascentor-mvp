'use client';

// City list with search and Join, plus the "Suggest a city" box. Joining uses the existing joinGroup action.

import { members } from '@/lib/rx/plural';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { joinGroup, requestGroup } from '@/app/(app)/community/actions';
import { useToast } from '@/components/rx/Toast';
import EmptyLamp from '@/components/rx/pages/EmptyLamp';

export interface CityRow { id: string; slug: string; name: string; country: string; count: number; description: string; joined: boolean; isMine: boolean }

function SuggestCity({ initial = '', link = false }: { initial?: string; link?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const label = link ? 'Suggest a city' : 'Suggest your city';
  return (
    <>
      {link
        ? <button type="button" className="rx-link" onClick={() => { setText(initial); setOpen((o) => !o); }}>{label}<ArrowRight aria-hidden /></button>
        : <button type="button" className="rx-btn secondary" onClick={() => { setText(initial); setOpen((o) => !o); }}>{label}</button>}
      {open && (
        <div className="rx-stack-sm rx-rise" style={{ width: '100%' }}>
          <input className="rx-in" aria-label="Your city" placeholder="City and country" value={text} maxLength={120} onChange={(e) => setText(e.target.value)} />
          <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
            const r = await requestGroup(`City group: ${text.trim()}`);
            if (!r.ok) { setError(r.error); return; }
            setOpen(false); setError(''); toast('Thanks. We open new cities as members ask for them.');
          })}>Send</button></div>
          {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        </div>
      )}
    </>
  );
}

export { SuggestCity };

/** Join button for the "Your city" card when the member's profile city has a group they have not joined yet. */
export function JoinCityButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
      const r = await joinGroup(id);
      toast(r.ok ? `You joined ${name}.` : r.error);
      router.refresh();
    })}>{pending ? 'Joining…' : `Join ${name}`}</button>
  );
}

function CityCard({ c }: { c: CityRow }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="rx-gcard">
      <span className="rx-dimdot"><MapPin aria-hidden /></span>
      <div className="gci">
        <Link href={`/community/groups/${c.slug}`} className="gname">{c.name}{c.isMine ? ' · your city' : ''}</Link>
        <p className="rx-sm">{c.country} · {members(c.count)}</p>
        <p className="rx-sm">{c.description}</p>
      </div>
      {c.joined
        ? <Link href={`/community/groups/${c.slug}`} className="rx-btn secondary">Open</Link>
        : <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => {
            const r = await joinGroup(c.id);
            toast(r.ok ? `You joined ${c.name}.` : r.error);
            router.refresh();
          })}>Join</button>}
    </div>
  );
}

export function CityList({ cities }: { cities: CityRow[] }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = useMemo(() => cities.filter((c) => !query || c.name.toLowerCase().includes(query) || c.country.toLowerCase().includes(query)), [cities, query]);
  return (
    <div className="rx-stack-lg">
      <label className="rx-search">
        <Search aria-hidden />
        <input placeholder="Search cities or countries" aria-label="Search cities" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="rx-stack-sm">
        <p className="rx-label">{query ? 'Results' : 'All cities'}</p>
        {list.map((c) => <CityCard key={c.id} c={c} />)}
        {list.length === 0 && (
          <div className="rx-empty">
            <EmptyLamp />
            <p className="rx-p">No city group there yet.</p>
            <SuggestCity initial={q.trim()} />
          </div>
        )}
      </div>
    </div>
  );
}
