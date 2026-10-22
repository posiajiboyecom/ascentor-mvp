'use client';

// components/billing/CheckoutV2.tsx
// Checkout v2 (BILLING_V2=on). Three steps:
//   1 Plan     tier (Seeker or Builder, defaulted from the member's stage), monthly or yearly with the saving explained,
//              solo or group (start a group, or use a group code or link), BOTH prices shown for a group.
//   2 Card     saved cards and "Add a card" (a NGN 50 check, refunded). A default card is needed to continue.
//   3 Confirm  free for 7 days, first charge on day 8 with the exact date and amount, cancel before to pay nothing. Starts the trial.
// Then a clear confirmation and on to the dashboard. Prices come only from lib/billing/catalog.ts. Leaders never see this page.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import CardsPanel, { type CardView } from './CardsPanel';
import { fmtDate } from './format';
import { formatNaira, getPlan, planCodeFor, priceFor, tierLabel, type Cycle, type Tier } from '@/lib/billing/catalog';
import { checkoutSummary } from '@/lib/billing/preview';
import { GROUP_MIN, TRIAL_DAYS } from '@/lib/billing/rules';

type GroupMode = 'solo' | 'create' | 'join';
interface Choice { tier: Tier; cycle: Cycle; groupMode: GroupMode; code: string }

const STORE = 'asc_checkout_v2';

const TIER_INFO: Record<Tier, { blurb: string; bullets: string[] }> = {
  explorer: {
    blurb: 'For people finding their direction.',
    bullets: ['Today tab and daily practices', 'Sage, your AI coach, with a daily message limit', 'Core Learn tracks', 'Join one Circle with mentor sessions', 'Open house community group', 'Direct messages'],
  },
  builder: {
    blurb: 'For people building a career or a business.',
    bullets: ['Everything in Seeker', 'A higher daily limit with Sage', 'Core and advanced Learn tracks', 'Industry mentorship', 'Remote internships and work experience', 'Business opportunities for members running a business'],
  },
};

/** "ASC-7K2Q", or a pasted link like https://joinascentor.com/join/<token>. */
function parseGroupInput(raw: string): { code?: string; token?: string } {
  const t = raw.trim();
  const m = t.match(/\/join\/([A-Za-z0-9_-]{16,64})/);
  if (m) return { token: m[1] };
  return t ? { code: t } : {};
}

export default function CheckoutV2({ defaultTier, initialCards, verifyAmountLabel, existingGroupCode, presetCode, tz }: {
  defaultTier: Tier;
  initialCards: CardView[];
  verifyAmountLabel: string;
  /** Set when the member is already in a group (for example they came through a group link). */
  existingGroupCode: string | null;
  /** From /checkout?group=ASC-XXXX. */
  presetCode: string | null;
  tz: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [choice, setChoice] = useState<Choice>({
    tier: defaultTier, cycle: 'monthly', groupMode: existingGroupCode ? 'join' : presetCode ? 'join' : 'solo', code: existingGroupCode ?? presetCode ?? '',
  });
  const [cards, setCards] = useState<CardView[]>(initialCards);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [groupNote, setGroupNote] = useState(existingGroupCode ? `You are in group ${existingGroupCode}.` : '');
  const [started, setStarted] = useState<{ trialEndsAt: string; nextChargeAt: string } | null>(null);
  const [secs, setSecs] = useState(6);
  const [now, setNow] = useState<Date | null>(null);

  // Coming back from Paystack: restore what the member chose, and go to the card step (the panel verifies the card).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('card') === 'verify') {
      try {
        const saved = sessionStorage.getItem(STORE);
        if (saved) setChoice((c) => ({ ...c, ...(JSON.parse(saved) as Partial<Choice>) }));
      } catch { /* the member simply picks again */ }
      setStep(2);
    }
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    if (secs <= 0) { router.push('/dashboard'); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, secs, router]);

  const set = (patch: Partial<Choice>) => { setChoice((c) => ({ ...c, ...patch })); setError(''); };
  const hasDefault = cards.some((c) => c.isDefault);

  const savePlan = useCallback(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify(choice)); } catch { /* ignore */ }
  }, [choice]);

  const post = async (url: string, body?: unknown) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const out = await r.json().catch(() => ({}));
    return { ok: r.ok, out } as { ok: boolean; out: Record<string, unknown> };
  };

  // Step 1 -> 2: settle the group (start one, or join by code or link) before the card step so a bad code is caught early.
  const toCard = async () => {
    setError(''); setBusy(true);
    try {
      if (choice.groupMode === 'create') {
        const r = await post('/api/billing/groups');
        if (!r.ok) { setError(String(r.out.error || 'We could not start your group.')); setBusy(false); return; }
        const g = r.out.group as { code: string };
        setGroupNote(`Your group code is ${g.code}. You can share it once your trial has started.`);
      } else if (choice.groupMode === 'join') {
        const parsed = parseGroupInput(choice.code);
        if (!parsed.code && !parsed.token) { setError('Enter your group code or paste your group link.'); setBusy(false); return; }
        const r = await post('/api/billing/groups/join', parsed);
        if (!r.ok) { setError(String(r.out.error || 'We could not find that group.')); setBusy(false); return; }
        const g = r.out.group as { code: string };
        setGroupNote(`You are in group ${g.code}.`);
      } else setGroupNote('');
    } catch { setError('We could not reach the server. Please try again.'); setBusy(false); return; }
    savePlan();
    setBusy(false);
    setStep(2);
  };

  const startTrial = async () => {
    setError(''); setBusy(true);
    try {
      const r = await post('/api/billing/subscription/start', { tier: choice.tier, cycle: choice.cycle });
      if (!r.ok) { setError(String(r.out.error || 'We could not start your trial. Please try again.')); setBusy(false); return; }
      setStarted({ trialEndsAt: String(r.out.trialEndsAt), nextChargeAt: String(r.out.nextChargeAt) });
      try { sessionStorage.removeItem(STORE); } catch { /* ignore */ }
      // The group now has one more active member: refresh its status so it can reach 3.
      void fetch('/api/billing/groups', { cache: 'no-store' }).catch(() => undefined);
      setStep(4);
    } catch { setError('We could not reach the server. Nothing was started. Please try again.'); }
    setBusy(false);
  };

  const per = (cycle: Cycle) => (cycle === 'yearly' ? 'a year' : 'a month');
  const inGroupFlow = choice.groupMode !== 'solo';
  const savingNote = (tier: Tier, gm: boolean) => {
    const m = priceFor(tier, gm ? 'group' : 'solo', 'monthly');
    const y = priceFor(tier, gm ? 'group' : 'solo', 'yearly');
    return `${formatNaira(y)} a year. You pay for ${gm ? 11 : 10} months and get 12, which saves ${formatNaira(m * 12 - y)}.`;
  };

  const plan = getPlan(planCodeFor(choice.tier, 'solo', choice.cycle))!;
  const summary = now ? checkoutSummary({ tier: choice.tier, cycle: choice.cycle, withGroup: inGroupFlow, start: now }, (d) => fmtDate(d.toISOString(), tz)) : null;

  // ── Done ──────────────────────────────────────────────────
  if (step === 4 && started) {
    return (
      <div className="bl-co">
        <div className="rx-card st" role="status" aria-live="polite">
          <span className="rx-tag rust" style={{ alignSelf: 'flex-start' }}>Trial started</span>
          <h1 className="rx-title" style={{ fontSize: 28 }}>You are in. Your {TRIAL_DAYS} days free have started.</h1>
          <p className="rx-p">Your free trial runs until {fmtDate(started.trialEndsAt, tz)}. Your first charge is on {fmtDate(started.nextChargeAt, tz)}: {inGroupFlow ? `${formatNaira(priceFor(choice.tier, 'group', choice.cycle))} if ${GROUP_MIN} members of your group are active by then, otherwise ${formatNaira(plan.amountKobo)}` : formatNaira(plan.amountKobo)}. You can cancel before then and pay nothing. You can manage everything under Settings, Billing.</p>
          <div className="rx-row">
            <Link href="/dashboard" className="rx-btn primary bl-focus">Go to your dashboard</Link>
            <Link href="/settings/billing" className="rx-btn secondary bl-focus">See your billing</Link>
          </div>
          <p className="rx-sm">Taking you to your dashboard in {Math.max(secs, 0)} {secs === 1 ? 'second' : 'seconds'}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bl-co">
      <div className="rx-stack-sm">
        <h1 className="rx-title" style={{ fontSize: 30 }}>Start your free trial</h1>
        <p className="rx-p">{TRIAL_DAYS} days free. Add a card now, pay nothing until day 8, and cancel before then to pay nothing at all.</p>
      </div>
      <ol className="bl-steps" aria-label={`Step ${Math.min(step, 3)} of 3`}>
        {[1, 2, 3].map((n) => <li key={n} className={step === n ? 'cur' : step > n ? 'done' : ''} aria-current={step === n ? 'step' : undefined} />)}
      </ol>

      {/* ── Step 1: plan ───────────────────────────────────── */}
      {step === 1 && (
        <div className="rx-stack-lg">
          <fieldset className="rx-stack-sm" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="rx-sl" style={{ marginBottom: 8 }}>1. Choose your plan</legend>
            <div className="bl-tiers" role="group" aria-label="Plan">
              {(['explorer', 'builder'] as Tier[]).map((t) => (
                <button key={t} type="button" aria-pressed={choice.tier === t} className="bl-choice" onClick={() => set({ tier: t })}>
                  <span className="t">{tierLabel(t)}</span>
                  <span className="p">{formatNaira(priceFor(t, 'solo', 'monthly'))} a month</span>
                  <span className="d">{TIER_INFO[t].blurb}</span>
                  <ul>{TIER_INFO[t].bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                </button>
              ))}
            </div>
            <p className="rx-sm">Your stage sets the plan we suggest. Any member can choose Builder.</p>
          </fieldset>

          <fieldset className="rx-stack-sm" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="rx-sl" style={{ marginBottom: 8 }}>2. Monthly or yearly</legend>
            <div className="bl-tiers" role="group" aria-label="Billing">
              <button type="button" aria-pressed={choice.cycle === 'monthly'} className="bl-choice" onClick={() => set({ cycle: 'monthly' })}>
                <span className="t">Monthly</span>
                <span className="p">{formatNaira(priceFor(choice.tier, inGroupFlow ? 'group' : 'solo', 'monthly'))} a month</span>
                <span className="d">Pay each month. Cancel any time.</span>
              </button>
              <button type="button" aria-pressed={choice.cycle === 'yearly'} className="bl-choice" onClick={() => set({ cycle: 'yearly' })}>
                <span className="t">Yearly</span>
                <span className="p">{formatNaira(priceFor(choice.tier, inGroupFlow ? 'group' : 'solo', 'yearly'))} a year</span>
                <span className="d">{savingNote(choice.tier, inGroupFlow)}</span>
              </button>
            </div>
          </fieldset>

          <fieldset className="rx-stack-sm" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="rx-sl" style={{ marginBottom: 8 }}>3. Pay alone, or with friends</legend>
            <div className="bl-tiers" role="group" aria-label="Group">
              <button type="button" aria-pressed={choice.groupMode === 'solo'} className="bl-choice" onClick={() => set({ groupMode: 'solo' })}>
                <span className="t">Just me</span>
                <span className="d">{formatNaira(priceFor(choice.tier, 'solo', choice.cycle))} {per(choice.cycle)}.</span>
              </button>
              <button type="button" aria-pressed={choice.groupMode === 'create'} className="bl-choice" onClick={() => set({ groupMode: 'create' })} disabled={!!existingGroupCode}>
                <span className="t">Pay as a group</span>
                <span className="d">Start a group and share your code, link or QR code. Everyone pays for themselves.</span>
              </button>
              <button type="button" aria-pressed={choice.groupMode === 'join'} className="bl-choice" onClick={() => set({ groupMode: 'join' })}>
                <span className="t">I have a group code or link</span>
                <span className="d">Join a friend&rsquo;s group.</span>
              </button>
            </div>
            {inGroupFlow && (
              <div className="bl-msg" role="note">
                <b>{formatNaira(priceFor(choice.tier, 'group', choice.cycle))} once {GROUP_MIN} friends join, {formatNaira(priceFor(choice.tier, 'solo', choice.cycle))} until then</b> ({per(choice.cycle)}, for {tierLabel(choice.tier)}). Each person pays for themselves. The group price starts at your first charge if {GROUP_MIN} members are active by then.
              </div>
            )}
            {choice.groupMode === 'join' && (
              <div className="rx-stack-sm">
                <label htmlFor="co-code" className="rx-sl">Group code or link</label>
                <input id="co-code" className="rx-in" value={choice.code} onChange={(e) => set({ code: e.target.value })} placeholder="ASC-7K2Q or the link your friend sent" autoComplete="off" spellCheck={false} disabled={!!existingGroupCode} />
              </div>
            )}
          </fieldset>

          {error && <div className="bl-msg bad" role="alert">{error}</div>}
          <div><button type="button" className="rx-btn primary block bl-focus" disabled={busy} onClick={toCard}>{busy ? 'One moment...' : 'Continue to your card'}</button></div>
        </div>
      )}

      {/* ── Step 2: card ───────────────────────────────────── */}
      {step === 2 && (
        <div className="rx-stack-lg">
          {groupNote && <div className="bl-msg ok" role="status">{groupNote}</div>}
          <CardsPanel initialCards={initialCards} returnTo="checkout" verifyAmountLabel={verifyAmountLabel} onCardsChange={setCards} beforeRedirect={savePlan}
            heading="2. Add a card" intro="You will not be charged until day 8. Your default card is the one we charge." />
          <div className="rx-row">
            <button type="button" className="rx-btn secondary bl-focus" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="rx-btn primary bl-focus" disabled={!hasDefault} onClick={() => setStep(3)}>Continue</button>
            {!hasDefault && <span className="rx-sm">Add a card to continue.</span>}
          </div>
        </div>
      )}

      {/* ── Step 3: confirm ────────────────────────────────── */}
      {step === 3 && (
        <div className="rx-stack-lg">
          <section className="rx-card st bl-sum" aria-labelledby="co-sum-h">
            <h2 id="co-sum-h" className="rx-h3">3. Your trial</h2>
            <div className="row"><span>Plan</span><b>{tierLabel(choice.tier)}, {choice.cycle === 'yearly' ? 'yearly' : 'monthly'}</b></div>
            <div className="row"><span>Price</span><b>{inGroupFlow ? `${formatNaira(priceFor(choice.tier, 'group', choice.cycle))} with a group of ${GROUP_MIN}, otherwise ${formatNaira(priceFor(choice.tier, 'solo', choice.cycle))}` : formatNaira(priceFor(choice.tier, 'solo', choice.cycle))}</b></div>
            <div className="row"><span>Card</span><b>{(() => { const c = cards.find((x) => x.isDefault); return c ? `${c.brand ?? 'Card'} ending ${c.last4}` : ''; })()}</b></div>
            <hr />
            {summary && (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li className="rx-p">{summary.trialLine}</li>
                <li className="rx-p">{summary.chargeLine}</li>
                {summary.groupLine && <li className="rx-p">{summary.groupLine}</li>}
                <li className="rx-p">{summary.cancelLine}</li>
              </ul>
            )}
          </section>
          {error && <div className="bl-msg bad" role="alert">{error}</div>}
          <div className="rx-row">
            <button type="button" className="rx-btn secondary bl-focus" disabled={busy} onClick={() => setStep(2)}>Back</button>
            <button type="button" className="rx-btn primary bl-focus" disabled={busy || !hasDefault} onClick={startTrial}>{busy ? 'Starting...' : `Start my ${TRIAL_DAYS} days free`}</button>
          </div>
          <p className="rx-sm"><Check aria-hidden style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> You can cancel from Settings, Billing at any time before day 8.</p>
        </div>
      )}
    </div>
  );
}
