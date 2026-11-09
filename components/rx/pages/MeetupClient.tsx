'use client';

// Meetup interactions: RSVP (saved), add to calendar (.ics from the real meetup), cancel (host), report, and the plan form.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowRight, Calendar, MapPin, User } from 'lucide-react';
import { Avatar } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';
import { cancelMeetup, createMeetup, reportMeetup, setRsvp } from '@/app/(app)/community/meetups/actions';

type Rsvp = 'going' | 'maybe' | 'no';
const OPTS: [Rsvp, string][] = [['going', 'Going'], ['maybe', 'Maybe'], ['no', 'Can’t go']];

export interface MeetupBodyProps {
  id: string; title: string; when: string; area: string; venue: string | null; hostName: string; description: string;
  startsAt: string; endsAt: string; mine: Rsvp | null; going: number; maybe: number; isHost: boolean; cancelled: boolean; past: boolean;
  people: { id: string; name: string; avatarUrl: string | null }[]; cityChatHref: string; canCancel: boolean;
}

const icsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function MeetupBody(p: MeetupBodyProps) {
  const toast = useToast();
  const router = useRouter();
  const [rsvp, setR] = useState<Rsvp | null>(p.mine);
  const [venue, setVenue] = useState<string | null>(p.venue);
  const [busy, start] = useTransition();
  const closed = p.cancelled || p.past;

  const pick = (v: Rsvp) => start(async () => {
    const prev = rsvp; setR(v);
    const r = await setRsvp(p.id, v);
    if (!r.ok) { setR(prev); toast(r.error); return; }
    if (r.venue) setVenue(r.venue); else if (!p.isHost) setVenue(null);
    toast(v === 'going' ? 'You’re going. The exact place is now showing.' : 'Saved.');
    router.refresh();
  });

  const addToCalendar = () => {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ascentor//Meetup//EN', 'BEGIN:VEVENT', `UID:${p.id}@joinascentor.com`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(new Date(p.startsAt).toISOString())}`, `DTEND:${icsDate(new Date(p.endsAt).toISOString())}`,
      `SUMMARY:${icsText(p.title)}`, `LOCATION:${icsText(venue ? `${venue}, ${p.area}` : p.area)}`,
      `DESCRIPTION:${icsText(`Hosted by ${p.hostName}. ${p.description}`.trim())}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'meetup'}.ics`; a.click();
    URL.revokeObjectURL(url);
    toast('Calendar file downloaded.');
  };

  const cancel = () => start(async () => {
    if (!window.confirm('Cancel this meetup for everyone?')) return;
    const r = await cancelMeetup(p.id);
    if (!r.ok) { toast(r.error); return; }
    toast('Meetup cancelled.'); router.refresh();
  });

  const going = p.going;
  return (
    <div className="rx-stack-lg">
      {p.cancelled && <div className="rx-soft"><p className="rx-p rx-strong">This meetup was cancelled.</p></div>}
      {!p.cancelled && p.past && <div className="rx-soft"><p className="rx-p rx-strong">This meetup has already happened.</p></div>}
      <div className="rx-card rx-stack">
        <p className="rx-meta-line rx-p"><Calendar aria-hidden />{p.when}</p>
        <p className="rx-meta-line rx-p"><MapPin aria-hidden />{venue ? `${venue}, ${p.area}` : `${p.area} · the exact place is shared with people going`}</p>
        <p className="rx-meta-line rx-p"><User aria-hidden />Hosted by {p.isHost ? 'you' : p.hostName}</p>
        {p.description && <p className="rx-p" style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>}
        {!closed && !p.isHost && (
          <div className="rx-fld">
            <label id="rsvp-l">Are you going?</label>
            <div className="rx-opts" role="group" aria-labelledby="rsvp-l">
              {OPTS.map(([v, l]) => <button key={v} type="button" disabled={busy} className={`rx-opt${rsvp === v ? ' on' : ''}`} aria-pressed={rsvp === v} onClick={() => pick(v)}>{l}</button>)}
            </div>
          </div>
        )}
        <div className="rx-row">
          {!closed && <button type="button" className="rx-btn secondary" onClick={addToCalendar}>Add to calendar</button>}
          <Link href={p.cityChatHref} className="rx-link">Ask in the city chat<ArrowRight aria-hidden /></Link>
          {!closed && p.canCancel && <button type="button" className="rx-link" disabled={busy} onClick={cancel} style={{ color: 'var(--rx-err, #B42318)' }}>Cancel meetup</button>}
        </div>
      </div>
      <div className="rx-stack-sm">
        <p className="rx-label">{going} going{p.maybe ? ` · ${p.maybe} maybe` : ''}</p>
        {p.people.length > 0 ? (
          <div className="rx-going">
            {p.people.map((m) => <span key={m.id} title={m.name}><Avatar name={m.name} url={m.avatarUrl} seed={m.id} /></span>)}
            {going > p.people.length && <span className="rx-sm">and {going - p.people.length} more</span>}
          </div>
        ) : <p className="rx-sm">Nobody yet. Be the first.</p>}
      </div>
    </div>
  );
}

export function ReportMeetup({ id }: { id: string }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const report = () => start(async () => {
    const reason = window.prompt('What’s wrong with this meetup? (optional)') ?? null;
    if (reason === null) return;
    const r = await reportMeetup(id, reason);
    toast(r.ok ? 'Reported. Our safety team will review it.' : r.error);
  });
  return <button type="button" className="rx-link" disabled={busy} onClick={report}>Report this meetup<ArrowRight aria-hidden /></button>;
}

export function PlanMeetupForm({ cities, initialGroupId, today }: { cities: { id: string; name: string }[]; initialGroupId?: string; today: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [f, setF] = useState({ groupId: initialGroupId && cities.some((c) => c.id === initialGroupId) ? initialGroupId : cities[0]?.id ?? '', title: '', description: '', area: '', venue: '', date: '', start: '10:00', end: '12:00' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createMeetup(f);
      if (!r.ok) { toast(r.error); return; }
      toast('Meetup posted. Your city group can see it now.');
      router.push(`/community/meetups/${r.id}`);
    });
  };
  return (
    <form className="rx-card rx-stack" onSubmit={submit}>
      <div className="rx-fld"><label htmlFor="mu-city">City</label>
        <select id="mu-city" className="rx-in" value={f.groupId} onChange={set('groupId')}>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="rx-fld"><label htmlFor="mu-title">What’s the meetup?</label>
        <input id="mu-title" className="rx-in" required maxLength={120} value={f.title} onChange={set('title')} placeholder="e.g. Study meetup in Yaba" /></div>
      <div className="rx-fld"><label htmlFor="mu-desc">Details <span className="rx-sm">(optional)</span></label>
        <textarea id="mu-desc" className="rx-in" rows={4} maxLength={2000} value={f.description} onChange={set('description')} placeholder="What will you do? Who is it for? What should people bring?" style={{ padding: 12, minHeight: 100 }} /></div>
      <div className="rx-grid2">
        <div className="rx-fld"><label htmlFor="mu-area">Area</label>
          <input id="mu-area" className="rx-in" required maxLength={120} value={f.area} onChange={set('area')} placeholder="e.g. Yaba" /><span className="rx-sm">Everyone in the city group sees this.</span></div>
        <div className="rx-fld"><label htmlFor="mu-venue">Exact place</label>
          <input id="mu-venue" className="rx-in" required maxLength={200} value={f.venue} onChange={set('venue')} placeholder="Venue name and street" /><span className="rx-sm">Only people going see this.</span></div>
      </div>
      <div className="rx-grid2">
        <div className="rx-fld"><label htmlFor="mu-date">Date</label><input id="mu-date" type="date" className="rx-in" required min={today} value={f.date} onChange={set('date')} /></div>
        <div className="rx-grid2">
          <div className="rx-fld"><label htmlFor="mu-start">Starts</label><input id="mu-start" type="time" className="rx-in" required value={f.start} onChange={set('start')} /></div>
          <div className="rx-fld"><label htmlFor="mu-end">Ends</label><input id="mu-end" type="time" className="rx-in" required value={f.end} onChange={set('end')} /></div>
        </div>
      </div>
      <p className="rx-sm">Times are in your own time zone. Pick a public place.</p>
      <div><button type="submit" className="rx-btn primary" disabled={busy || !f.groupId}>{busy ? 'Posting…' : 'Post meetup'}</button></div>
    </form>
  );
}
