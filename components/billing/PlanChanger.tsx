'use client';

// components/billing/PlanChanger.tsx
// Settings > Billing: choose Seeker, Builder or Pinnacle, monthly or yearly.
// During the free trial the change applies straight away (nothing has been paid). On a paid plan it starts at the next
// billing date, and the plan already paid for stays until then (lib/billing/subscriptions.ts changePlan). No proration.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/rx/Toast';
import { PAID_TIERS, formatMoney, priceFor, tierLabel, type Currency, type Cycle, type Tier } from '@/lib/billing/catalog';
import { PLAN_BULLETS } from '@/lib/plans-display';
import { fmtDate } from './format';

export default function PlanChanger({ tier, cycle, trial, nextChargeAt, scheduled, currency, closed, tz }: {
  tier: Tier; cycle: Cycle; trial: boolean; nextChargeAt: string | null; scheduled: { tier: Tier; cycle: Cycle; planName: string } | null;
  currency: Currency; closed: Tier[]; tz: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const startTier = scheduled?.tier ?? tier;
  const startCycle = scheduled?.cycle ?? cycle;
  const [t, setT] = useState<Tier>(startTier);
  const [c, setC] = useState<Cycle>(startCycle);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const money = (minor: number) => formatMoney(minor, currency);
  const changed = t !== startTier || c !== startCycle;
  const when = fmtDate(nextChargeAt, tz);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body: { tier?: Tier; cycle?: Cycle } = {};
      if (t !== tier) body.tier = t;
      if (c !== cycle) body.cycle = c;
      if (!body.tier && !body.cycle) { body.tier = t; body.cycle = c; } // going back to the current plan cancels a scheduled change
      const r = await fetch('/api/billing/subscription/change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ kind: 'bad', text: String(j.error || 'That did not work. Nothing was changed.') }); return; }
      const name = `${tierLabel(t)}, ${c === 'yearly' ? 'yearly' : 'monthly'}`;
      const text = j.effective === 'now' ? `You’re now on ${name}.` : t === tier && c === cycle ? `You’ll stay on ${name}.` : `You’ll move to ${name} on ${when}. You keep your current plan until then.`;
      setMsg({ kind: 'ok', text }); toast(text); router.refresh();
    } catch { setMsg({ kind: 'bad', text: 'We could not reach the server. Nothing was changed.' }); }
    finally { setBusy(false); }
  };

  return (
    <section className="rx-card st" aria-labelledby="bl-change-h">
      <div>
        <p className="rx-sl">Change plan</p>
        <h2 id="bl-change-h" className="rx-h3" style={{ margin: 0 }}>Seeker, Builder or Pinnacle</h2>
      </div>
      {scheduled && <div className="bl-msg" role="status">From {when} you’ll be on {scheduled.planName}. Until then you keep what you paid for.</div>}
      <div className="bl-tiers bl-tiers-3" role="group" aria-label="Plan">
        {PAID_TIERS.map((x) => {
          const isClosed = closed.includes(x) && x !== tier;
          return (
            <button key={x} type="button" className="bl-choice" aria-pressed={t === x} disabled={isClosed || busy}
              style={isClosed ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => setT(x)}>
              <span className="t">{tierLabel(x)}{x === tier ? ' · current' : ''}{isClosed ? ' · not open right now' : ''}</span>
              <span className="p">{money(priceFor(x, 'solo', 'monthly', currency))} a month</span>
              <ul>{PLAN_BULLETS[x].map((b) => <li key={b}>{b}</li>)}</ul>
            </button>
          );
        })}
      </div>
      <div className="bl-tiers" role="group" aria-label="Billing">
        {(['monthly', 'yearly'] as Cycle[]).map((y) => (
          <button key={y} type="button" className="bl-choice" aria-pressed={c === y} disabled={busy} onClick={() => setC(y)}>
            <span className="t">{y === 'yearly' ? 'Yearly' : 'Monthly'}</span>
            <span className="p">{money(priceFor(t, 'solo', y, currency))} {y === 'yearly' ? 'a year' : 'a month'}</span>
          </button>
        ))}
      </div>
      <p className="rx-sm">{trial ? 'You’re in your free trial, so a change applies straight away.' : `A change starts on your next billing date, ${when}. You keep your current plan until then.`}</p>
      {msg && <div className={`bl-msg ${msg.kind}`} role={msg.kind === 'bad' ? 'alert' : 'status'} aria-live="polite">{msg.text}</div>}
      <div className="rx-row">
        <button type="button" className="rx-btn primary" disabled={!changed || busy} onClick={save}>{busy ? 'Saving…' : 'Save plan'}</button>
      </div>
    </section>
  );
}
