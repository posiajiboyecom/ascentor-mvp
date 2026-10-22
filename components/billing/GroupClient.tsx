'use client';

// components/billing/GroupClient.tsx
// Group status page: code, link, QR, ACTIVE COUNT of 3 needed, forming / active / broken in plain words, Share on WhatsApp.
// Also: start a group, join with a code, leave. Never shows who is in the group, who failed to pay, or any payment detail.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';
import { confirmAction } from '@/components/Modal';
import { fmtDate } from './format';
import { formatNaira } from '@/lib/billing/catalog';
import { GROUP_MIN } from '@/lib/billing/rules';
import type { GroupStatusView } from '@/lib/billing/groups';

type Msg = { kind: 'ok' | 'bad'; text: string } | null;

const STATUS_LABEL = { forming: 'Forming', active: 'Complete', broken: 'Below 3' } as const;

export default function GroupClient({ status, qr, tz, prices }: {
  status: GroupStatusView; qr: string | null; tz: string;
  /** From catalog.ts via the server: Seeker solo and group monthly, in kobo, for the explainer line. */
  prices: { soloKobo: number; groupKobo: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const g = status.group;

  const call = async (key: string, url: string, body: unknown, ok: string) => {
    setBusy(key); setMsg(null);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ kind: 'bad', text: String(out.error || 'Something went wrong. Please try again.') });
      else { setMsg({ kind: 'ok', text: ok }); toast(ok); router.refresh(); }
    } catch { setMsg({ kind: 'bad', text: 'We could not reach the server. Nothing was changed.' }); }
    setBusy(null);
  };

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied.`); } catch { toast('Copy did not work. Select the text and copy it.'); }
  };

  const leave = async () => {
    const yes = await confirmAction('Leave your group? You will lose the group price once the group has fewer than 3 active members. If other people are in your group, you can only switch groups once every 90 days.', { title: 'Leave this group?', confirmLabel: 'Leave group', cancelLabel: 'Stay in the group', danger: true });
    if (yes) await call('leave', '/api/billing/groups/leave', null, 'You left the group.');
  };

  const share = g ? `Join my group on Ascentor. When 3 of us are members, each of us pays less. Use the code ${g.code} or open this link: ${g.link}` : '';

  if (!status.inGroup || !g) {
    return (
      <>
        <section className="rx-card st" aria-labelledby="gr-intro-h">
          <h2 id="gr-intro-h" className="rx-h3">How groups work</h2>
          <p className="rx-p">When {GROUP_MIN} or more of you are active members together, each person pays the lower group price: {formatNaira(prices.groupKobo)} a month for Seeker instead of {formatNaira(prices.soloKobo)}. Everyone pays for themselves, and nobody pays for anyone else.</p>
          <p className="rx-sm">You can be in one group at a time, and you can switch groups once every 90 days.</p>
          {status.canSwitchAt && <div className="bl-msg" role="note">You can join or start a different group from {fmtDate(status.canSwitchAt, tz)}.</div>}
        </section>

        <section className="rx-card st" aria-labelledby="gr-start-h">
          <h2 id="gr-start-h" className="rx-h3">Start a group</h2>
          <p className="rx-p">You get a code, a link and a QR code to share with friends.</p>
          <div><button type="button" className="rx-btn primary bl-focus" disabled={!!busy} onClick={() => call('create', '/api/billing/groups', null, 'Your group is ready. Share your code with friends.')}>{busy === 'create' ? 'Starting...' : 'Start a group'}</button></div>
        </section>

        <form className="rx-card st" aria-labelledby="gr-join-h" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void call('join', '/api/billing/groups/join', { code: code.trim() }, 'You joined the group.'); }}>
          <h2 id="gr-join-h" className="rx-h3">Join with a code</h2>
          <label htmlFor="gr-code" className="rx-sl">Group code</label>
          <input id="gr-code" className="rx-in" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ASC-7K2Q" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={24} />
          {msg && <div className={`bl-msg ${msg.kind === 'ok' ? 'ok' : 'bad'}`} role={msg.kind === 'bad' ? 'alert' : 'status'} aria-live="polite">{msg.text}</div>}
          <div><button type="submit" className="rx-btn secondary bl-focus" disabled={!!busy || !code.trim()}>{busy === 'join' ? 'Joining...' : 'Join group'}</button></div>
        </form>
      </>
    );
  }

  return (
    <>
      <section className="rx-card st" aria-labelledby="gr-status-h">
        <div className="rx-sb top">
          <div>
            <p className="rx-sl">Your group</p>
            <h2 id="gr-status-h" className="rx-big">{status.underReview ? 'Being checked' : status.status ? STATUS_LABEL[status.status] : 'Forming'}</h2>
          </div>
          <span className={`rx-tag${status.status === 'active' && !status.underReview ? ' rust' : ''}`}>{status.activeCount} of {GROUP_MIN} active</span>
        </div>
        <div className="bl-dots" role="img" aria-label={`${Math.min(status.activeCount, GROUP_MIN)} of ${GROUP_MIN} active members`}>
          {Array.from({ length: GROUP_MIN }).map((_, i) => <span key={i} className={`bl-dot${i < status.activeCount ? ' on' : ''}`}>{i < status.activeCount && <Check aria-hidden />}</span>)}
        </div>
        <p className="rx-p">{status.statusText}</p>
        <p className="rx-sm">Active means on a free trial, paying, or inside the 7 day grace period after a missed payment. We only ever show the count.</p>
      </section>

      <section className="rx-card st" aria-labelledby="gr-share-h">
        <h2 id="gr-share-h" className="rx-h3">Invite friends</h2>
        <div className="rx-stack-sm">
          <p className="rx-sl">Group code</p>
          <div className="rx-row" style={{ justifyContent: 'space-between' }}>
            <span className="bl-code" aria-label={`Group code ${g.code.split('').join(' ')}`}>{g.code}</span>
            <button type="button" className="rx-btn secondary bl-focus" onClick={() => copy(g.code, 'Code')}><Copy aria-hidden style={{ width: 16, height: 16 }} />Copy code</button>
          </div>
        </div>
        <div className="rx-stack-sm">
          <p className="rx-sl">Group link</p>
          <p className="bl-linkbox">{g.link}</p>
          <div className="rx-row">
            <button type="button" className="rx-btn secondary bl-focus" onClick={() => copy(g.link, 'Link')}><Copy aria-hidden style={{ width: 16, height: 16 }} />Copy link</button>
            <a className="rx-btn primary bl-focus" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden style={{ width: 18, height: 18 }} />Share on WhatsApp</a>
          </div>
        </div>
        {qr && (
          <div className="rx-stack-sm">
            <p className="rx-sl">QR code</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bl-qr" src={qr} alt={`QR code for your group link. Friends scan it to join with code ${g.code}.`} width={200} height={200} />
            <p className="rx-sm">Friends sitting together can scan this to join the same group.</p>
          </div>
        )}
        <p className="rx-sm">Each code works for up to 10 uses and stops working after 45 days. A group can have up to 10 members.</p>
      </section>

      <section className="rx-card st" aria-labelledby="gr-leave-h">
        <h2 id="gr-leave-h" className="rx-h3">Leave this group</h2>
        <p className="rx-p">If you leave, you pay the solo price from your next billing date. You can switch to another group once every 90 days.</p>
        {msg && <div className={`bl-msg ${msg.kind === 'ok' ? 'ok' : 'bad'}`} role={msg.kind === 'bad' ? 'alert' : 'status'} aria-live="polite">{msg.text}</div>}
        <div><button type="button" className="rx-btn bdanger bl-focus" disabled={!!busy} onClick={leave}>{busy === 'leave' ? 'Leaving...' : 'Leave group'}</button></div>
      </section>
    </>
  );
}
