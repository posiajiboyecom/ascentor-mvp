'use client'

// app/pricing/PricingClient.tsx
// Client component — manages tab, currency, and billing cycle state.

import { useState, useEffect } from 'react'
import { B2C_TIERS, B2B_TIERS, Currency, BillingCycle } from './data'
import B2CPlanCard from './components/B2CPlanCard'
import B2BPlanCard from './components/B2BPlanCard'
import RevenueModel from './components/RevenueModel'

type Tab = 'b2c' | 'b2b' | 'revenue'

const TABS: { id: Tab; label: string }[] = [
  { id: 'b2c', label: 'For you' },
  { id: 'b2b', label: 'For your organisation' },
  { id: 'revenue', label: 'Revenue model' },
]

export default function PricingClient() {
  const [tab, setTab] = useState<Tab>('b2c')
  const [currency, setCurrency] = useState<Currency>('ngn')
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  // Auto-detect locale on mount — flip to USD for non-NG users
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
      if (!tz.startsWith('Africa/Lagos') && !tz.startsWith('Africa/Abuja')) {
        setCurrency('usd')
      }
    } catch {
      // ignore — keep NGN as default
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pricing</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Invest in your career.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cancel anytime. 7-day free trial on paid plans.
        </p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="mb-8 flex justify-center gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'rounded-full border px-5 py-1.5 text-[13px] transition-all',
              tab === t.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-transparent text-muted-foreground hover:border-foreground/50 hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* B2C TAB                                                        */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {tab === 'b2c' && (
        <div>
          {/* Currency + billing controls */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {/* Currency toggle */}
            <div className="flex gap-2">
              {[
                { val: 'ngn' as Currency, label: '₦ Nigeria' },
                { val: 'usd' as Currency, label: '$ Global' },
              ].map(c => (
                <button
                  key={c.val}
                  onClick={() => setCurrency(c.val)}
                  className={[
                    'rounded-full border px-4 py-1 text-[12px] transition-all',
                    currency === c.val
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  ].join(' ')}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Annual / monthly toggle */}
            <div className="flex items-center gap-2 rounded-full border border-border p-0.5">
              {[
                { val: 'monthly' as BillingCycle, label: 'Monthly' },
                { val: 'annual' as BillingCycle, label: 'Annual · save 20%' },
              ].map(b => (
                <button
                  key={b.val}
                  onClick={() => setBilling(b.val)}
                  className={[
                    'rounded-full px-4 py-1.5 text-[12px] transition-all',
                    billing === b.val
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <p className="mb-6 text-[11px] text-muted-foreground">
            {currency === 'ngn'
              ? 'Showing Nigerian naira (₦). Switch to $ for diaspora / global pricing.'
              : 'Showing USD pricing for global / diaspora users. Switch to ₦ for Nigeria pricing.'}
          </p>

          {/* Plan cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {B2C_TIERS.map(tier => (
              <B2CPlanCard key={tier.id} tier={tier} currency={currency} billing={billing} />
            ))}
          </div>

          {/* Rationale */}
          <div className="mt-10">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Pricing rationale
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(currency === 'ngn'
                ? [
                    { label: 'Free tier purpose', text: 'Acquisition — no credit card. Session cap forces upgrade. 15–20% convert within 60 days if coaching delivers value.' },
                    { label: '₦12k Builder logic', text: '~$7 USD. Less than one business lunch. Targets professionals earning ₦300k–₦600k/month.' },
                    { label: '₦25k Pro logic', text: 'Your revenue engine. The AI content agent saves 5+ hours/week — frame the upgrade around time saved, not features unlocked.' },
                    { label: '₦60k Elite logic', text: 'Price anchor that makes Pro feel affordable. 10 Elite subscribers = ₦600k/month from this tier alone.' },
                  ]
                : [
                    { label: 'Benchmark — Builder $19', text: 'Below LinkedIn Premium ($40). Above Calm ($15). Frame it as: career ROI vs entertainment spend.' },
                    { label: 'Benchmark — Pro $39', text: 'One human coaching session costs $150–$500. $39/month for unlimited AI coaching + content writing is a clear win.' },
                    { label: 'Diaspora conversion', text: 'Diaspora users convert 25–30% faster — higher disposable income and stronger career anxiety around standing out globally.' },
                    { label: 'Elite $99 anchor', text: 'Positions Pro as obvious value. Less than one hour with a human executive coach ($150–500/hr) — lead with this comparison.' },
                  ]
              ).map((item) => (
                <div key={item.label} className="rounded-xl border-l-2 border-border bg-muted/30 py-3 pl-4 pr-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-[12px] leading-relaxed text-foreground/80">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* B2B TAB                                                        */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {tab === 'b2b' && (
        <div>
          <p className="mb-6 text-[11px] text-muted-foreground">
            All B2B plans priced in USD. Partners collect their own revenue from members in any currency.
          </p>

          {/* Billing toggle */}
          <div className="mb-6 flex justify-end">
            <div className="flex items-center gap-2 rounded-full border border-border p-0.5">
              {[
                { val: 'monthly' as BillingCycle, label: 'Monthly' },
                { val: 'annual' as BillingCycle, label: 'Annual · save 15%' },
              ].map(b => (
                <button
                  key={b.val}
                  onClick={() => setBilling(b.val)}
                  className={[
                    'rounded-full px-4 py-1.5 text-[12px] transition-all',
                    billing === b.val
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* B2B cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {B2B_TIERS.map(tier => (
              <B2BPlanCard key={tier.id} tier={tier} billing={billing} />
            ))}
          </div>

          {/* Seat pricing logic */}
          <div className="mt-10">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Seat pricing logic
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: 'What counts as a seat', text: 'Each active member on the partner\'s platform is one seat. Inactive users (90+ days) don\'t count.' },
                { label: 'Why flat + per seat', text: 'Flat fee covers your infrastructure baseline. Seat charge scales revenue as the partner grows — you win when they win.' },
                { label: 'Volume discount trigger', text: 'Partners with 500+ seats get custom pricing. This forces an enterprise conversation and protects margin at scale.' },
                { label: 'Annual discount', text: '15% off annual on the flat fee only — not on seats. Keeps your recurring seat revenue predictable month to month.' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border-l-2 border-border bg-muted/30 py-3 pl-4 pr-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-[12px] leading-relaxed text-foreground/80">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* B2B insights */}
          <div className="mt-8">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              What's included at every tier
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: 'Studio — who buys this', text: 'Individual coaches, consultants, and small training businesses launching their first branded platform. Low friction entry point.' },
                { label: 'Academy — who buys this', text: 'Training companies, professional associations, corporate L&D teams. This is your primary B2B revenue tier.' },
                { label: 'AI agents as the B2B differentiator', text: 'No competing white-label platform gives partners access to autonomous content, intel, and personal brand agents. This is your unfair advantage — lead with it.' },
                { label: 'Why $499 flat + $3/seat', text: 'A partner with 200 members pays $1,099/month. They can charge $20–$50/month per member and profit 5–10× — a clear ROI argument.' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border-l-2 border-border bg-muted/30 py-3 pl-4 pr-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-[12px] leading-relaxed text-foreground/80">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* REVENUE MODEL TAB                                             */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {tab === 'revenue' && <RevenueModel />}
    </div>
  )
}
