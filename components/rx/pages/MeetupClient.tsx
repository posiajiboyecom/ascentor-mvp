'use client';

// Meetup detail interactions.
// TODO(meetups): there is no meetups table or RSVP/report backend yet. RSVP is kept in this component only,
// "Add to calendar" downloads a real .ics for the sample event, and "Report" only confirms. Wire these to a
// rx_meetups / rx_meetup_rsvps table (and a 'meetup' kind in reportContent) when that backend exists.

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Calendar, MapPin, User } from 'lucide-react';
import { Avatar } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';

const PEOPLE = ['Tolu Adeyemi', 'Seyi Martins', 'Amaka Eze', 'Ibrahim Sani', 'Ngozi Obi', 'Bayo Ogunleye'];
const OPTS: [string, string][] = [['going', 'Going'], ['maybe', 'Maybe'], ['no', 'Can’t go']];

export function MeetupBody({ cityChatHref }: { cityChatHref: string }) {
  const toast = useToast();
  const [rsvp, setRsvp] = useState('');

  const pick = (v: string) => { setRsvp(v); toast(v === 'going' ? 'You’re going. The exact place is now showing.' : 'Saved.'); };
  const addToCalendar = () => {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ascentor//Meetup//EN', 'BEGIN:VEVENT', 'UID:yaba-study-20261024@joinascentor.com',
      'DTSTAMP:20261001T000000Z', 'DTSTART:20261024T090000Z', 'DTEND:20261024T120000Z', 'SUMMARY:Study meetup in Yaba', 'LOCATION:Yaba\\, Lagos',
      'DESCRIPTION:Hosted by Tolu Adeyemi. Bring what you are studying.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'study-meetup-yaba.ics'; a.click();
    URL.revokeObjectURL(url);
    toast('Added to your calendar.');
  };

  return (
    <div className="rx-stack-lg">
      <div className="rx-card rx-stack">
        <p className="rx-meta-line rx-p"><Calendar aria-hidden />Saturday 24 October · 10:00 AM to 1:00 PM WAT</p>
        <p className="rx-meta-line rx-p"><MapPin aria-hidden />{rsvp === 'going' ? '[VENUE NAME], [STREET], Yaba, Lagos' : 'Yaba, Lagos · the exact place is shared with people going'}</p>
        <p className="rx-meta-line rx-p"><User aria-hidden />Hosted by Tolu Adeyemi</p>
        <p className="rx-p">Bring what you’re studying. Two hours of quiet work, then lunch together for anyone who wants to stay.</p>
        <div className="rx-fld">
          <label id="rsvp-l">Are you going?</label>
          <div className="rx-opts" role="group" aria-labelledby="rsvp-l">
            {OPTS.map(([v, l]) => <button key={v} type="button" className={`rx-opt${rsvp === v ? ' on' : ''}`} aria-pressed={rsvp === v} onClick={() => pick(v)}>{l}</button>)}
          </div>
        </div>
        <div className="rx-row">
          <button type="button" className="rx-btn secondary" onClick={addToCalendar}>Add to calendar</button>
          <Link href={cityChatHref} className="rx-link">Ask in the city chat<ArrowRight aria-hidden /></Link>
        </div>
      </div>
      <div className="rx-stack-sm">
        <p className="rx-label">{14 + (rsvp === 'going' ? 1 : 0)} going · 6 maybe</p>
        <div className="rx-going">
          {PEOPLE.map((n) => <span key={n} title={n}><Avatar name={n} /></span>)}
          <span className="rx-sm">and more</span>
        </div>
      </div>
    </div>
  );
}

export function ReportMeetup() {
  const toast = useToast();
  return <button type="button" className="rx-link" onClick={() => toast('Reported. Our safety team will review it.')}>Report this meetup<ArrowRight aria-hidden /></button>;
}
