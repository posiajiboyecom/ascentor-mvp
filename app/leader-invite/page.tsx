import Link from 'next/link';
import { Check } from 'lucide-react';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

export const metadata = { title: 'Lead a Circle on Ascentor' };

const DO = [
  'Host the weekly Circle call and keep time.',
  'Check in on members who go quiet.',
  'Help your Circle choose a mentor and prepare session agendas.',
];
const GET = ['Ascentor free while you facilitate.', 'The Facilitators’ room, with other Leaders.'];

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rx-card rx-stack-sm">
      <p className="rx-label">{title}</p>
      {items.map((t) => (
        <p key={t} className="rx-p rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Check aria-hidden className="rx-gc" style={{ marginTop: 3, width: 18, height: 18 }} />{t}
        </p>
      ))}
    </div>
  );
}

// NOTE: there is no invite-token backend for facilitators yet, so this page is static. Accepting sends the
// person to sign in and on to the facilitator view.
export default function LeaderInvitePage() {
  return (
    <div className="rx rx-entry">
      <div className="rx-entry-in rx-rise">
        <Link href="/" className="rx-entry-logo"><img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" /></Link>
        <span className="rx-tag gold" style={{ alignSelf: 'flex-start' }}>Facilitator invite</span>
        <h1 className="rx-h2" style={{ fontSize: 28 }}>Lead a Circle on Ascentor</h1>
        <p className="rx-p">The Ascentor team has invited you to facilitate a Circle: a small group that meets every week for 90 days and helps each member keep their promises.</p>
        <List title="What you’d do" items={DO} />
        <List title="What you get" items={GET} />
        <Link href="/login?redirect=/circle/facilitator" className="rx-btn primary block">Accept and set up</Link>
        <Link href="/" className="rx-btn secondary block">Not now</Link>
      </div>
    </div>
  );
}
