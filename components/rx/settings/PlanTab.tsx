'use client';

// Settings > Plan: current plan and billing state, the plans, billing history.
// Real: state (from the profile), cancel (/api/subscription/cancel), pay / reactivate (/checkout), history (payments table).
// Toast only, as in the prototype (no backend yet): Update card, Receipt, Switch down to a lower plan, How Leaders are chosen.
// Prices are placeholders on purpose: see lib/plans-display.ts.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, CreditCard, Gift, TriangleAlert } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';
import { FEATURED_PLANS, LEADER_BULLETS, PLAN_BULLETS, PLAN_DISPLAY_NAME, PRICE_PLACEHOLDER, isUpgrade, type FeaturedPlan } from '@/lib/plans-display';
import type { BillState } from '@/lib/billing-state';

export interface HistoryRow { id: string; date: string; desc: string; amount: string; status: string; receipt: boolean }

export default function PlanTab({ state, plan, planName, tag, line, daysLeft, untilShort, cardLine, referralDays, history }: {
  state: BillState; plan: string; planName: string; tag: { label: string; cls: string }; line: string; daysLeft: number | null;
  untilShort: string; cardLine: string | null; referralDays: number; history: HistoryRow[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const paid = state !== 'none';
  const checkoutHref = `/checkout${plan === 'explorer' || plan === 'builder' ? `?plan=${plan}` : ''}`;
  const canCancel = state === 'active' || state === 'trialEnding';
  const days = daysLeft ?? 0;

  const askCancel = () => {
    toast(`Opens cancellation. You keep ${planName} until ${untilShort || 'the end of your billing period'}.`);
    setConfirming(true);
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/subscription/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { toast(body.error || 'We couldn’t cancel your subscription. Please try again.'); }
      else { toast(`Subscription cancelled. You keep ${planName} until ${untilShort || 'the end of your billing period'}.`); setConfirming(false); router.refresh(); }
    } catch { toast('We couldn’t reach the server. Nothing was cancelled.'); }
    setBusy(false);
  };

  const planCard = (id: FeaturedPlan) => {
    const name = PLAN_DISPLAY_NAME[id];
    const current = paid && state !== 'lapsed' && plan === id;
    return (
      <div key={id} className={`rx-plan${current ? ' cur' : ''}`}>
        {current ? <div className="rx-sb"><p className="rx-h3">{name}</p><span className="rx-tag rust">Your plan</span></div> : <p className="rx-h3">{name}</p>}
        <p className="rx-price">{PRICE_PLACEHOLDER}<span className="rx-sm"> / month</span></p>
        <ul>{PLAN_BULLETS[id].map((b) => <li key={b}>{b}</li>)}</ul>
        {current ? (
          <button type="button" className="rx-btn bmuted" aria-disabled="true">Current plan</button>
        ) : !paid || state === 'lapsed' || isUpgrade(plan, id) ? (
          <Link href={`/checkout?plan=${id}`} className="rx-btn secondary">{!paid || state === 'lapsed' ? `Choose ${name}` : `Switch to ${name}`}</Link>
        ) : (
          <button type="button" className="rx-btn secondary" onClick={() => toast(`You’d move to ${name} at your next renewal.`)}>Switch to {name}</button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="rx-card st">
        <div className="rx-sb top"><div><p className="rx-sl">Current plan</p><p className="rx-big">{planName}</p><p className="rx-sm">{line}</p></div><span className={tag.cls}>{tag.label}</span></div>

        {state === 'trialEnding' && (
          <div className="rx-banner" role="note"><Clock aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div>Your trial ends in {days} {days === 1 ? 'day' : 'days'}. We’ll email you the day before your first payment.</div></div>
        )}
        {state === 'failed' && (
          <div className="rx-banner err" role="alert"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} />
            <div><b>Your last payment failed.</b> Your bank declined the charge. Update your card within 7 days to keep full access.
              <div className="rx-row" style={{ marginTop: 8 }}><Link href={checkoutHref} className="rx-btn primary">Update card and pay</Link></div></div></div>
        )}
        {state === 'lapsed' && (
          <div className="rx-soft rx-stack-sm"><p className="rx-p">You’re on light access. Today, your Circle chat and Sage still work. Learn pathways, mentor sessions and joining new groups are paused.</p>
            <div><Link href={checkoutHref} className="rx-btn primary">Reactivate {planName}</Link></div></div>
        )}
        {state === 'none' && (
          <div className="rx-soft rx-stack-sm"><p className="rx-p">You’re on the free version. Choose a plan below to start your 7-day free trial.</p></div>
        )}

        {paid && cardLine && (
          <div className="rx-sb"><div className="rx-row rx-nw" style={{ gap: 10, minWidth: 0 }}><CreditCard aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><span>{cardLine}</span></div>
            <button type="button" className="rx-btn lkb" onClick={() => toast('Opens Paystack to update your card.')}>Update card<ArrowRight aria-hidden /></button></div>
        )}
        {referralDays > 0 && (
          <div className="rx-soft rx-row rx-nw" style={{ gap: 10 }}><Gift aria-hidden style={{ width: 18, height: 18, flex: 'none', color: 'var(--rx-gold)' }} /><p className="rx-sm" style={{ color: 'var(--rx-ink)' }}>+{referralDays} referral days will be added at your next renewal.</p></div>
        )}
        {canCancel && !confirming && (
          <div className="rx-row"><button type="button" className="rx-btn lkb muted" onClick={askCancel}>Cancel subscription</button></div>
        )}
        {canCancel && confirming && (
          <div className="rx-soft rx-stack-sm">
            <p className="rx-p">Cancel {planName}? You keep {planName} until {untilShort || 'the end of your billing period'}, and we won’t charge you again.</p>
            <div className="rx-row">
              <button type="button" className="rx-btn bdanger" disabled={busy} onClick={cancel}>{busy ? 'Cancelling...' : 'Cancel subscription'}</button>
              <button type="button" className="rx-btn secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep {planName}</button>
            </div>
          </div>
        )}
      </div>

      <div className="rx-stack-sm"><p className="rx-sl">Plans</p><p className="rx-sm">Every plan starts with a 7-day free trial. Your stage is set from onboarding, and any member can choose Builder.</p></div>
      <div className="rx-grid3">
        {FEATURED_PLANS.map(planCard)}
        <div className="rx-plan">
          <p className="rx-h3">Leader</p>
          <p className="rx-price">Free</p>
          <ul>{LEADER_BULLETS.map((b) => <li key={b}>{b}</li>)}</ul>
          <div><button type="button" className="rx-btn lkb" onClick={() => toast('Leaders are set from onboarding answers, or invited as facilitators.')}>How Leaders are chosen<ArrowRight aria-hidden /></button></div>
        </div>
      </div>

      <div className="rx-card">
        <p className="rx-sl" style={{ marginBottom: 8 }}>Billing history</p>
        <div className="rx-tbl-wrap">
          <table className="rx-tbl">
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th /></tr></thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={5} className="rx-sm">Nothing here yet. Your payments will appear here.</td></tr>}
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{h.date}</td><td>{h.desc}</td><td>{h.amount}</td><td>{h.status}</td>
                  <td>{h.receipt && <button type="button" className="rx-btn lkb" style={{ minHeight: 32 }} onClick={() => toast('Opens the receipt.')}>Receipt</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="rx-sm">If a payment fails, you keep light access until you update your card.</p>
    </>
  );
}
