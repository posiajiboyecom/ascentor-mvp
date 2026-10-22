'use client';

// components/billing/BillingClient.tsx
// Settings > Billing (billing v2). Shows: plan and state in plain words, next charge (date, amount, price type, credit applied),
// payment methods (CardsPanel), cancel / resume / reactivate, credit balance with an invite link, a short billing history.
// All numbers arrive as props from the server (lib/billing/member-view.ts, prices from catalog.ts). This file never decides a price.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Gift, Users } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';
import { confirmAction } from '@/components/Modal';
import CardsPanel, { type CardView } from './CardsPanel';
import { fmtDate, fmtDateShort } from './format';
import { stateWords } from '@/lib/billing/preview';
import { formatNaira } from '@/lib/billing/catalog';
import { GROUP_MIN } from '@/lib/billing/rules';
import type { BillingViewData } from '@/lib/billing/member-view';

type Msg = { kind: 'ok' | 'bad'; text: string } | null;

export default function BillingClient({ data, tz }: { data: BillingViewData; tz: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [cards, setCards] = useState<CardView[]>(data.cards);
  const { sub, next, group } = data;
  const fmt = (iso: string | null) => fmtDate(iso, tz);

  const words = sub
    ? stateWords({
        state: sub.state, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, trialEndsAt: sub.trialEndsAt, nextChargeAt: sub.nextChargeAt,
        periodEnd: sub.periodEnd, graceEndsAt: sub.graceEndsAt, amountLabel: next ? formatNaira(next.payKobo) : null, now: new Date(),
      }, fmt)
    : null;

  const run = async (key: string, url: string, ok: (body: Record<string, unknown>) => string) => {
    setBusy(key); setMsg(null);
    try {
      const r = await fetch(url, { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ kind: 'bad', text: String(body.error || 'Something went wrong. Please try again.') });
      else { const text = ok(body); setMsg({ kind: 'ok', text }); toast(text); router.refresh(); }
    } catch { setMsg({ kind: 'bad', text: 'We could not reach the server. Nothing was changed.' }); }
    setBusy(null);
  };

  const askCancel = async () => {
    if (!sub) return;
    const trial = sub.state === 'trial';
    const text = trial
      ? 'Cancel your free trial? You will not be charged. Your access ends now, and you can start again later.'
      : `Cancel your plan? You keep full access until ${fmt(sub.periodEnd)} and you will not be charged again.`;
    const yes = await confirmAction(text, { title: trial ? 'Cancel your trial?' : 'Cancel your plan?', confirmLabel: trial ? 'Cancel trial' : 'Cancel plan', cancelLabel: 'Keep my plan', danger: true });
    if (!yes) return;
    await run('cancel', '/api/billing/subscription/cancel', (b) =>
      trial ? 'Your trial is cancelled and you will not be charged.' : `Your plan is cancelled. You keep full access until ${fmt((b.accessUntil as string | null) ?? sub.periodEnd)}.`);
  };

  const resumable = !!sub && ((sub.state === 'active' && sub.cancelAtPeriodEnd) || (sub.state === 'cancelled' && !!sub.periodEnd && new Date(sub.periodEnd).getTime() > Date.now()));
  const cancellable = !!sub && ((sub.state === 'trial') || (sub.state === 'active' && !sub.cancelAtPeriodEnd) || sub.state === 'grace');
  const reactivatable = !!sub && (sub.state === 'lapsed' || (sub.state === 'cancelled' && !resumable));

  const amountRow = next && (
    next.creditKobo > 0
      ? <>{formatNaira(next.payKobo)}<small>{formatNaira(next.grossKobo)} less {formatNaira(next.creditKobo)} credit</small></>
      : <>{formatNaira(next.grossKobo)}</>
  );

  return (
    <>
      {/* ── Plan ─────────────────────────────────────────────── */}
      <section className="rx-card st" aria-labelledby="bl-plan-h">
        <div className="rx-sb top">
          <div>
            <p className="rx-sl">Your plan</p>
            <h2 id="bl-plan-h" className="rx-big">{sub ? sub.planName : data.leaderFree ? 'Leader' : 'No plan yet'}</h2>
          </div>
          {words && <span className={`rx-tag${words.tone === 'rust' ? ' rust' : words.tone === 'gold' ? ' goldt' : ''}`}>{words.label}</span>}
          {!sub && data.leaderFree && <span className="rx-tag goldt">Free</span>}
        </div>

        {sub && words ? (
          <>
            <div className="rx-stack-sm">
              <p className="rx-p" style={{ fontWeight: 600 }}>{words.headline}</p>
              <p className="rx-p">{words.detail}</p>
            </div>
            {next && (sub.state === 'trial' || sub.state === 'active' || sub.state === 'grace') && !sub.cancelAtPeriodEnd && (
              <dl className="bl-facts">
                <div><dt>Next charge</dt><dd>{fmt(sub.nextChargeAt)}</dd></div>
                <div><dt>Amount</dt><dd>{amountRow}</dd></div>
                <div>
                  <dt>Price</dt>
                  <dd>
                    {next.priceType === 'group' ? 'Group price' : 'Solo price'}
                    {next.priceType === 'solo' && group.inGroup && (
                      <small>{group.underReview ? 'Your group is being checked first.' : `The group price, ${formatNaira(next.groupKobo)}, applies once ${group.needed} more ${group.needed === 1 ? 'friend is' : 'friends are'} active.`}</small>
                    )}
                    {next.priceType === 'solo' && !group.inGroup && <small>Join a group of 3 to pay {formatNaira(next.groupKobo)}.</small>}
                  </dd>
                </div>
                <div><dt>Billing</dt><dd>{sub.cycle === 'yearly' ? 'Once a year' : 'Every month'}</dd></div>
              </dl>
            )}
          </>
        ) : (
          <div className="rx-stack-sm">
            {data.legacyPlan
              ? <p className="rx-p">You are on your existing plan. It keeps working as it is, and you manage it on the <Link href="/settings?tab=plan" className="rx-link">Plan tab</Link>. You can start the new plan below at any time.</p>
              : data.leaderFree
              ? <p className="rx-p">You lead for free while you facilitate a Circle. There is nothing to pay and no card is needed.</p>
              : <p className="rx-p">You do not have a plan yet. Start with 7 days free. You add a card, and you are not charged until day 8. Cancel any time before then and you pay nothing.</p>}
          </div>
        )}

        {msg && <div className={`bl-msg ${msg.kind === 'ok' ? 'ok' : 'bad'}`} role={msg.kind === 'bad' ? 'alert' : 'status'} aria-live="polite">{msg.text}</div>}

        <div className="rx-row">
          {!sub && !data.leaderFree && <Link href="/checkout" className="rx-btn primary bl-focus">Start your free trial</Link>}
          {reactivatable && (
            <button type="button" className="rx-btn primary bl-focus" disabled={!!busy || cards.length === 0} onClick={() => run('react', '/api/billing/subscription/reactivate', () => 'Payment taken. Your plan is active again.')}>
              {busy === 'react' ? 'Taking payment...' : 'Pay and reactivate'}
            </button>
          )}
          {reactivatable && cards.length === 0 && <span className="rx-sm">Add a card below first.</span>}
          {resumable && (
            <button type="button" className="rx-btn primary bl-focus" disabled={!!busy} onClick={() => run('resume', '/api/billing/subscription/resume', () => 'Your plan is back on. We will not cancel it.')}>
              {busy === 'resume' ? 'Working...' : 'Resume my plan'}
            </button>
          )}
          {cancellable && (
            <button type="button" className="rx-btn secondary bl-focus" disabled={!!busy} onClick={askCancel}>
              {busy === 'cancel' ? 'Cancelling...' : sub?.state === 'trial' ? 'Cancel my trial' : 'Cancel my plan'}
            </button>
          )}
        </div>
      </section>

      {/* ── Payment methods ──────────────────────────────────── */}
      <CardsPanel initialCards={data.cards} returnTo="settings" verifyAmountLabel={data.verifyAmountLabel} onCardsChange={setCards}
        intro={sub ? 'Your default card is charged when your plan renews.' : 'Add a card to start your free trial.'} />

      {/* ── Group ────────────────────────────────────────────── */}
      <section className="rx-card st" aria-labelledby="bl-group-h">
        <div className="rx-sb">
          <h2 id="bl-group-h" className="rx-h3">Pay less with friends</h2>
          <Users aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-muted)' }} />
        </div>
        {group.inGroup ? (
          <p className="rx-p">{group.statusText} {group.activeCount} of {GROUP_MIN} active.</p>
        ) : (
          <p className="rx-p">When 3 of you are active members together, each person pays the lower group price. Everyone pays for themselves.</p>
        )}
        <div><Link href="/settings/billing/group" className="rx-link">{group.inGroup ? 'See your group' : 'Start or join a group'}<ArrowRight aria-hidden /></Link></div>
      </section>

      {/* ── Credit ───────────────────────────────────────────── */}
      <section className="rx-card st" aria-labelledby="bl-credit-h">
        <div className="rx-sb">
          <h2 id="bl-credit-h" className="rx-h3">Credit</h2>
          <Gift aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-gold)' }} />
        </div>
        <p className="rx-big">{formatNaira(data.creditBalanceKobo)}</p>
        <p className="rx-sm">Credit comes from friends you invite. It is taken off your next charge, up to the full amount, and it is not cash.</p>
        <div><Link href="/referral" className="rx-link">Invite a friend<ArrowRight aria-hidden /></Link></div>
      </section>

      {/* ── History ──────────────────────────────────────────── */}
      <section className="rx-card" aria-labelledby="bl-hist-h">
        <h2 id="bl-hist-h" className="rx-sl" style={{ marginBottom: 8 }}>Billing history</h2>
        <div className="rx-tbl-wrap">
          <table className="rx-tbl">
            <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th></tr></thead>
            <tbody>
              {data.history.length === 0 && <tr><td colSpan={3} className="rx-sm">Nothing here yet. Your payments will appear here.</td></tr>}
              {data.history.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(h.dateIso, tz)}</td>
                  <td>{h.desc}{h.credit && <span className="rx-sm" style={{ display: 'block' }}>{h.credit}</span>}</td>
                  <td>{h.amountLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
