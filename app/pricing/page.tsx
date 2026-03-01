import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — Ascentor',
  description: 'Affordable leadership coaching for African professionals. Plans starting at $15/month with AI coaching, expert sessions, and peer cohorts.',
};

const TIERS = [
  {
    name: 'Starter',
    price: 15,
    desc: 'For individual contributors ready to grow into leadership.',
    color: '#14B8A6',
    features: [
      'AI coaching — 20 sessions/month',
      '1 peer cohort (15 members)',
      'Access to expert session recordings',
      'Leadership framework library',
      'Email support',
    ],
    missing: ['Live expert sessions', 'Priority matching', 'Custom development plan'],
    cta: 'Start Free Trial',
    href: '/signup',
    popular: false,
  },
  {
    name: 'Pro',
    price: 29,
    desc: 'For mid-level professionals and first-time managers.',
    color: '#E8A020',
    features: [
      'AI coaching — unlimited sessions',
      '2 peer cohorts',
      'Live expert sessions (monthly)',
      'Priority cohort matching',
      'Personal development plan',
      'Career strategy templates',
      'Priority support',
    ],
    missing: ['1-on-1 expert sessions'],
    cta: 'Start Free Trial',
    href: '/signup',
    popular: true,
  },
  {
    name: 'Premium',
    price: 49,
    desc: 'For senior leaders and executives scaling their impact.',
    color: '#8B5CF6',
    features: [
      'Everything in Pro',
      'AI coaching — unlimited + priority',
      'Unlimited cohort access',
      '1-on-1 expert session (quarterly)',
      'Executive peer circle',
      'Advanced analytics dashboard',
      'White-glove onboarding',
      'Dedicated account manager',
    ],
    missing: [],
    cta: 'Start Free Trial',
    href: '/signup',
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', color: '#1A1A1A', fontFamily: "'Syne', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-for-light-pages.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm hidden md:block" style={{ color: '#6B7280' }}>Log In</Link>
            <Link href="/signup" className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#E8A020', color: '#000' }}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-6 text-center px-5">
        <h1 className="text-4xl md:text-5xl font-semibold mb-3"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
          Invest in your growth
        </h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: '#6B7280' }}>
          What used to cost $5,000–$10,000 in executive coaching, now starts at $15/month. All plans include a 7-day free trial.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="py-10 px-5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {TIERS.map((t) => (
            <div key={t.name} className="rounded-2xl p-6 relative flex flex-col"
              style={{
                background: '#fff',
                border: t.popular ? `2px solid ${t.color}` : '1px solid #E5E5E4',
                boxShadow: t.popular ? `0 8px 30px ${t.color}18` : '0 1px 3px rgba(0,0,0,0.04)',
              }}>
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                  style={{ background: t.color, color: '#000' }}>
                  Most Popular
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
                  {t.name}
                </h3>
                <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>{t.desc}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: t.color }}>
                    ${t.price}
                  </span>
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>/month</span>
                </div>
              </div>

              <div className="flex-1">
                {t.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 py-1.5">
                    <span className="text-sm mt-0.5" style={{ color: t.color }}>✓</span>
                    <span className="text-sm" style={{ color: '#374151' }}>{f}</span>
                  </div>
                ))}
                {t.missing.map((f) => (
                  <div key={f} className="flex items-start gap-2 py-1.5">
                    <span className="text-sm mt-0.5" style={{ color: '#D1D5DB' }}>—</span>
                    <span className="text-sm" style={{ color: '#D1D5DB' }}>{f}</span>
                  </div>
                ))}
              </div>

              <Link href={t.href}
                className="block text-center px-6 py-3.5 rounded-xl text-sm font-semibold mt-6 transition-transform hover:scale-105"
                style={{
                  background: t.popular ? t.color : 'transparent',
                  color: t.popular ? '#000' : '#374151',
                  border: t.popular ? 'none' : '1.5px solid #E5E5E4',
                }}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise */}
      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto rounded-2xl p-8 text-center"
          style={{ background: '#0C0B08' }}>
          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-4"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#E8A020', border: '1px solid rgba(245,158,11,0.2)' }}>
            FOR ORGANIZATIONS
          </div>
          <h3 className="text-2xl md:text-3xl font-semibold mb-3"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F3F4F6' }}>
            Ascentor for Teams
          </h3>
          <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: '#9CA3AF', lineHeight: 1.7 }}>
            Develop your entire leadership pipeline. Custom cohorts, branded experience, manager dashboards, and dedicated support for organizations with 10+ seats.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:asamuel@ascentorbi.com"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold"
              style={{ background: '#E8A020', color: '#000' }}>
              Contact Sales
            </a>
            <a href="https://zbooking.us/kA4x3"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid #374151', color: '#F3F4F6' }}>
              Schedule a Demo
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 px-5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
            Frequently asked questions
          </h2>
          {[
            { q: 'Is there a free trial?', a: 'Yes! Every plan includes a 7-day free trial. No credit card required to start.' },
            { q: 'Can I switch plans?', a: 'Absolutely. Upgrade or downgrade anytime from your dashboard. Changes take effect on your next billing cycle.' },
            { q: 'What payment methods do you accept?', a: 'We accept cards via Paystack (including Nigerian cards), Selar, and international cards. Mobile money coming soon.' },
            { q: 'How is the AI coaching different from ChatGPT?', a: 'Our AI is specifically trained on leadership frameworks, African business context, and career strategy. It uses a Socratic coaching model — asking the right questions rather than just giving answers.' },
            { q: 'What\'s the refund policy?', a: 'Full refund within 30 days of your first payment, no questions asked. We want you to try risk-free.' },
          ].map((f) => (
            <details key={f.q} className="group mb-3 rounded-xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #E5E5E4' }}>
              <summary className="px-5 py-4 cursor-pointer text-sm font-semibold flex justify-between items-center"
                style={{ color: '#0C0B08' }}>
                {f.q}
                <span className="text-xs group-open:rotate-180 transition-transform" style={{ color: '#9CA3AF' }}>▼</span>
              </summary>
              <div className="px-5 pb-4 text-sm" style={{ color: '#6B7280', lineHeight: 1.7 }}>
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs" style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}>
        <p>© {new Date().getFullYear()} Ascentor Inc. · <Link href="/terms">Terms</Link> · <Link href="/blog">Blog</Link></p>
      </footer>
    </div>
  );
}
