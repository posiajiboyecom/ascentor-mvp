// app/pricing/page.tsx
// Public pricing: Seeker, Builder, Pinnacle and Ascentor for Teams (coming soon), in the visitor's currency
// (naira in Nigeria, US dollars elsewhere, decided on the server from where they are).
import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';
import PublicShell from '@/components/layout/PublicShell';
import PricingSection from '@/components/marketing/PricingSection';
import { visitorCurrency } from '@/lib/geo';
import { publicPricing } from '@/lib/pricing-public';
import { generatePageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generatePageMetadata({
  title: 'Pricing',
  description: 'Seeker, Builder and Pinnacle. Every plan starts with 7 days free. Naira in Nigeria, US dollars everywhere else.',
  path: '/pricing',
});

const FAQ: [string, string][] = [
  ['Do I need a card for the free week?', 'Yes. You add a card when you choose your plan, and the first charge is on day 8. To check the card, we take a small amount and refund it straight away. Cancel before day 8 and you pay nothing.'],
  ['Which plan should I choose?', 'Any plan works at any stage. Seeker covers your Circle, mentorship, Learn and Sage. Builder adds advanced pathways and career and business opportunities. Pinnacle adds a private mentor session every month and unlimited Sage. You can change plans at any time in Settings, Billing.'],
  ['Why do I see naira or US dollars?', 'Members in Nigeria pay in naira and everyone else pays in US dollars. We set this from where you are when you subscribe, and your plan keeps that currency after that.'],
  ['What is a group price?', 'In Nigeria, three or more friends can pay a lower price each. Start a group or join one at checkout. Everyone pays for themselves, and the group price applies once three members are active.'],
  ['Do Leaders pay?', 'No. Leaders who facilitate a Circle use Ascentor for free.'],
];

export default async function PricingPage() {
  const pricing = publicPricing(await visitorCurrency());
  return (
    <PublicShell>
      <PricingSection pricing={pricing} headingLevel={1} />
      <section style={{ padding: '0 1rem clamp(4rem, 8vw, 6rem)', background: '#FAFAF8' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Questions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQ.map(([q, a]) => (
              <details key={q} style={{ background: '#fff', border: '1px solid #E4E1D8', borderRadius: 12, padding: '1rem 1.25rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#0F0F0E', minHeight: 28 }}>{q}</summary>
                <p style={{ margin: '0.75rem 0 0', color: '#4B4B47', lineHeight: 1.7, fontSize: '0.9375rem' }}>{a}</p>
              </details>
            ))}
          </div>
          <p style={{ marginTop: '2rem', color: '#5B5B56', fontSize: '0.9375rem' }}>
            Still deciding? <Link href="/who-its-for" style={{ color: '#0F0F0E', fontWeight: 700 }}>See who Ascentor is for</Link> or <Link href="/contact" style={{ color: '#0F0F0E', fontWeight: 700 }}>ask us</Link>.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
