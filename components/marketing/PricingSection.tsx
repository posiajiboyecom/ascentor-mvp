'use client';

// components/marketing/PricingSection.tsx
// The public pricing section: Seeker, Builder, Pinnacle, and Ascentor for Teams and organisations (coming soon).
// Prices arrive from the server in the visitor's currency (lib/pricing-public.ts): naira in Nigeria, US dollars elsewhere.
// Visitors cannot switch currency here; the server decides it from where they are, the same way checkout does.

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { PublicPricing } from '@/lib/pricing-public';
import '@/styles/marketing.css';

type Cycle = 'monthly' | 'yearly';

export default function PricingSection({ pricing, id = 'pricing', headingLevel = 2 }: { pricing: PublicPricing; id?: string; headingLevel?: 1 | 2 }) {
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const usd = pricing.currency === 'USD';

  return (
    <section id={id} className="pr-wrap" aria-labelledby={`${id}-h`}>
      <style>{CSS}</style>
      <div className="pr-inner">
        <div className="pr-head">
          <p className="mkt-eyebrow rust">Pricing</p>
          <H id={`${id}-h`} className="pr-title">Every plan starts with<br />7 days free.</H>
          <p className="pr-sub">
            Pick the plan that fits you. Add a card to start, pay nothing until day 8, and cancel any time before then.
            You can change plans whenever you like.
          </p>
          <div className="pr-cycle" role="radiogroup" aria-label="Billing period">
            {(['monthly', 'yearly'] as Cycle[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cycle === c} className={cycle === c ? 'on' : ''} onClick={() => setCycle(c)}>
                {c === 'monthly' ? 'Monthly' : 'Yearly'}{c === 'yearly' && <span className="pr-save">2 months free</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="pr-grid">
          {pricing.plans.map((p) => (
            <article key={p.tier} className={`pr-card${p.tier === 'pinnacle' ? ' top' : ''}`}>
              <div className="pr-bar" aria-hidden />
              <h3 className="pr-name">{p.name}</h3>
              <p className="pr-blurb">{p.blurb}</p>
              <p className="pr-price">
                <span className="amt">{cycle === 'monthly' ? p.monthly : p.yearly}</span>
                <span className="per">{cycle === 'monthly' ? 'a month' : 'a year'}</span>
              </p>
              <p className="pr-note">
                {cycle === 'yearly' ? `Works out at ${p.yearlyPerMonth} a month.` : p.group ? `Or ${p.group}.` : 'Billed every month.'}
              </p>
              <ul className="pr-list">
                {p.bullets.map((b) => <li key={b}><Check size={15} aria-hidden /> <span>{b}</span></li>)}
              </ul>
              <Link href="/signup" className={p.tier === 'pinnacle' ? 'btn-rust pr-cta' : 'pr-cta pr-cta-line'}>Start 7 days free</Link>
            </article>
          ))}

          <article className="pr-card pr-teams">
            <span className="pr-soon">Coming soon</span>
            <h3 className="pr-name">Ascentor for Teams and organisations</h3>
            <p className="pr-blurb">For companies, schools, NGOs and communities that want to grow their people together.</p>
            <ul className="pr-list">
              {['Circles, Learn and mentorship for your whole group', 'One bill for every seat', 'A view of how your people are growing', 'Help setting it up for your organisation'].map((b) => (
                <li key={b}><Check size={15} aria-hidden /> <span>{b}</span></li>
              ))}
            </ul>
            <Link href="/contact?subject=teams" className="pr-cta pr-cta-gold">Tell me when it opens</Link>
          </article>
        </div>

        <div className="pr-foot">
          <p>
            Prices are shown in <b>{pricing.currencyName}</b>, based on where you are. {usd
              ? 'Members outside Nigeria pay in US dollars. Members in Nigeria pay in naira.'
              : 'Members in Nigeria pay in naira. Members outside Nigeria pay in US dollars.'} Your plan keeps its currency once you subscribe, even if you travel.
          </p>
          {!usd && <p>Group prices: join or start a group of {pricing.groupMin}. Each person pays for themselves, and the group price applies once {pricing.groupMin} members are active.</p>}
          <p>Leaders who facilitate a Circle use Ascentor for free.</p>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.pr-wrap { padding: clamp(4rem, 8vw, 7rem) 1rem; background: #FAFAF8; color: #0F0F0E; }
.pr-inner { max-width: 1200px; margin: 0 auto; }
.pr-head { max-width: 720px; margin-bottom: 2.5rem; }
.pr-title { font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif); font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.03em; margin: 1rem 0; text-transform: none; }
.pr-sub { color: #4B4B47; font-size: 1.0625rem; line-height: 1.7; margin: 0 0 1.75rem; }
.pr-cycle { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: #F0EEE8; border: 1px solid #E4E1D8; }
.pr-cycle button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 999px; border: 0; background: transparent; font: inherit; font-weight: 600; font-size: 0.9375rem; color: #4B4B47; cursor: pointer; }
.pr-cycle button.on { background: #0F0F0E; color: #FAFAF8; }
.pr-save { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(200,169,110,0.22); color: #7A5A1E; }
.pr-cycle button.on .pr-save { background: rgba(200,169,110,0.3); color: #E6CC97; }
.pr-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
@media (min-width: 680px) { .pr-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1120px) { .pr-grid { grid-template-columns: repeat(4, 1fr); } }
.pr-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 1.75rem 1.5rem 1.5rem; border-radius: 16px; background: #fff; border: 1px solid #E4E1D8; }
.pr-card.top { border-color: rgba(182,80,42,0.45); box-shadow: 0 18px 44px -28px rgba(182,80,42,0.55); }
.pr-bar { width: 2.5rem; height: 3px; border-radius: 2px; background: #C8A96E; margin-bottom: 1.25rem; }
.pr-card.top .pr-bar { background: var(--rust, #B6502A); }
.pr-name { font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif); font-size: 1.375rem; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 0.375rem; }
.pr-blurb { color: #5B5B56; font-size: 0.9375rem; line-height: 1.55; margin: 0 0 1.25rem; min-height: 2.9em; }
.pr-price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; margin: 0; }
.pr-price .amt { font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif); font-size: 2.25rem; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pr-price .per { color: #5B5B56; font-size: 0.9375rem; }
.pr-note { color: #6B6B66; font-size: 0.8125rem; line-height: 1.5; margin: 0.375rem 0 1.25rem; min-height: 2.6em; }
.pr-list { list-style: none; margin: 0 0 1.5rem; padding: 1.25rem 0 0; border-top: 1px solid #EEECE6; display: flex; flex-direction: column; gap: 0.625rem; flex: 1; }
.pr-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 0.9375rem; line-height: 1.45; color: #1F1F1C; }
.pr-list svg { flex: none; margin-top: 3px; color: #A07E3C; }
.pr-card.top .pr-list svg { color: var(--rust, #B6502A); }
.pr-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 1.25rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.9375rem; text-decoration: none; }
.pr-cta-line { border: 1.5px solid #0F0F0E; color: #0F0F0E; }
.pr-cta-line:hover { background: #0F0F0E; color: #FAFAF8; }
.pr-teams { background: #0F0F0E; border-color: #0F0F0E; color: #FAFAF8; }
.pr-teams .pr-blurb { color: #A8A69E; }
.pr-teams .pr-list { border-top-color: #2A2A27; }
.pr-teams .pr-list li { color: #E8E6DF; }
.pr-teams .pr-list svg { color: #C8A96E; }
.pr-soon { align-self: flex-start; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; background: rgba(200,169,110,0.16); color: #C8A96E; margin-bottom: 1.25rem; }
.pr-cta-gold { background: #C8A96E; color: #0F0F0E; }
.pr-cta-gold:hover { background: #D6BB86; }
.pr-foot { margin-top: 2rem; max-width: 820px; display: flex; flex-direction: column; gap: 0.5rem; }
.pr-foot p { margin: 0; color: #5B5B56; font-size: 0.875rem; line-height: 1.65; }
.pr-foot b { color: #0F0F0E; }
`;
