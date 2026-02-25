import type { Metadata } from 'next';
import Link from 'next/link';
import WaitlistForm from './WaitlistForm';

export const metadata: Metadata = {
  title: 'Join the Waitlist — Ascentor',
  description: "Africa's mentorship platform is almost here. Secure early access and get 3 months free on launch.",
};

const PROOF_POINTS = [
  {
    emoji: '🤖',
    title: '24/7 AI Mentor',
    desc: 'Personalized guidance trained on African career context — available at 2am before your biggest moment.',
  },
  {
    emoji: '🎓',
    title: 'Human Mentors Who\'ve Been There',
    desc: 'Live sessions with Africa\'s top professionals. Real experience. Not theory.',
  },
  {
    emoji: '👥',
    title: 'Your Mentorship Circle',
    desc: 'Matched with peers at your exact life stage. Your personal board of advisors.',
  },
];

const STATS = [
  { value: '247+', label: 'Already on waitlist' },
  { value: '15',   label: 'African countries' },
  { value: '24/7', label: 'AI mentor access' },
  { value: '$15',  label: 'Starting at launch' },
];

export default function WaitlistPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: '#FAFAF9', color: '#1A1A1A', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Nav (identical pattern to pricing page) ── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl" style={{ color: '#F59E0B' }}>⬆</span>
            <span className="text-lg font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
              Ascentor
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm hidden md:block" style={{ color: '#6B7280' }}>
              Log In
            </Link>
            <Link
              href="/pricing"
              className="text-sm hidden md:block font-medium"
              style={{ color: '#6B7280' }}
            >
              Pricing
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#F59E0B', color: '#000' }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero header ── */}
      <section className="pt-14 pb-4 text-center px-5">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#B45309' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: '#F59E0B' }} />
          Now open — 247 people already in line
        </div>

        <h1
          className="text-4xl md:text-5xl font-semibold mb-4"
          style={{ fontFamily: "'Playfair Display', serif", color: '#0A0E17', lineHeight: 1.1 }}
        >
          Everyone who made it<br />
          had someone who{' '}
          <span style={{ color: '#F59E0B', fontStyle: 'italic' }}>believed in them.</span>
        </h1>
        <p className="text-base max-w-xl mx-auto mb-2" style={{ color: '#6B7280', lineHeight: 1.7 }}>
          Ascentor is Africa&apos;s mentorship platform — from figuring out your path to reaching the
          top of your career. Join the waitlist and get{' '}
          <strong style={{ color: '#0A0E17' }}>3 months free</strong> on launch.
        </p>
      </section>

      {/* ── Stats bar ── */}
      <section className="py-6 px-5">
        <div
          className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden"
          style={{ background: '#E5E5E4' }}
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center py-5 px-3 text-center"
              style={{ background: '#fff' }}
            >
              <span
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "'Playfair Display', serif", color: '#F59E0B' }}
              >
                {s.value}
              </span>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main two-column section ── */}
      <section className="py-8 px-5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-start">

          {/* Left — proof points */}
          <div>
            {/* What you get */}
            <div className="mb-8">
              <p className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: '#9CA3AF' }}>
                What you&apos;re getting access to
              </p>
              <div className="flex flex-col gap-4">
                {PROOF_POINTS.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-start gap-4 p-4 rounded-xl"
                    style={{ background: '#fff', border: '1px solid #E5E5E4' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
                    >
                      {p.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: '#0A0E17' }}>
                        {p.title}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                        {p.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Early access perk callout */}
            <div
              className="rounded-2xl p-5"
              style={{ background: '#0A0E17' }}
            >
              <div
                className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-3"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                EARLY ACCESS PERK
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ fontFamily: "'Playfair Display', serif", color: '#F3F4F6' }}
              >
                3 months free on launch
              </h3>
              <p className="text-sm mb-4" style={{ color: '#9CA3AF', lineHeight: 1.7 }}>
                Waitlist members get exclusive early access and 3 months on us — no credit card
                needed. The earlier you join, the better your position.
              </p>
              <div className="flex flex-col gap-2">
                {[
                  'Priority access before public launch',
                  '3 months free on any plan',
                  'Founding member badge & recognition',
                  'Direct input into features we build',
                ].map((perk) => (
                  <div key={perk} className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#F59E0B' }}>✓</span>
                    <span className="text-xs" style={{ color: '#D1D5DB' }}>{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — form (client component) */}
          <div>
            <WaitlistForm />
          </div>

        </div>
      </section>

      {/* ── Social proof / testimonials ── */}
      <section className="py-10 px-5">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-center mb-6" style={{ color: '#9CA3AF' }}>
            What early members are saying
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                quote: 'The AI mentor helped me prepare for a promotion conversation I\'d been avoiding for months. I got the promotion.',
                name: 'Amara O.',
                role: 'Product Manager · Lagos',
                initial: 'A',
                color: '#F59E0B',
              },
              {
                quote: 'Having peers in similar roles across Africa gave me perspectives I\'d never find in my company alone.',
                name: 'David K.',
                role: 'Engineering Lead · Nairobi',
                initial: 'D',
                color: '#14B8A6',
              },
              {
                quote: 'At $15/month, this replaces the $200/session executive coach I couldn\'t afford. The AI is genuinely nuanced.',
                name: 'Fatima H.',
                role: 'Strategy Consultant · Accra',
                initial: 'F',
                color: '#8B5CF6',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-2xl p-5 flex flex-col justify-between"
                style={{ background: '#fff', border: '1px solid #E5E5E4' }}
              >
                <div>
                  <div className="flex mb-3">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-sm" style={{ color: '#F59E0B' }}>★</span>
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: '#374151' }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: t.color, color: '#fff' }}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0A0E17' }}>{t.name}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-10 px-5">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-2xl font-semibold text-center mb-8"
            style={{ fontFamily: "'Playfair Display', serif", color: '#0A0E17' }}
          >
            Frequently asked questions
          </h2>
          {[
            {
              q: 'When does Ascentor launch?',
              a: 'We\'re targeting Q2 2026. Waitlist members get access first, and early joiners will be notified at least 2 weeks before public launch.',
            },
            {
              q: 'What does the 3 months free mean?',
              a: 'Waitlist members get their first 3 months on any paid plan completely free when we launch. No credit card required to join the waitlist.',
            },
            {
              q: 'Who is Ascentor built for?',
              a: 'Anyone from a student figuring out their career path (Explorer, 15–22) to a mid-career professional aiming for the top (Climber, 32–50). We serve every stage of the professional journey with African context.',
            },
            {
              q: 'What payment methods will you accept at launch?',
              a: 'Paystack (Nigerian & African cards, bank transfer), Selar, and international cards. Mobile money coming soon after launch.',
            },
            {
              q: 'Can I refer friends to the waitlist?',
              a: 'Yes — and you should. After signing up, you\'ll get a personal referral link. Every friend who joins moves you up the list, giving you even earlier access.',
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group mb-3 rounded-xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #E5E5E4' }}
            >
              <summary
                className="px-5 py-4 cursor-pointer text-sm font-semibold flex justify-between items-center"
                style={{ color: '#0A0E17' }}
              >
                {f.q}
                <span
                  className="text-xs group-open:rotate-180 transition-transform"
                  style={{ color: '#9CA3AF' }}
                >
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-4 text-sm" style={{ color: '#6B7280', lineHeight: 1.7 }}>
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer (identical to pricing page) ── */}
      <footer
        className="py-8 text-center text-xs"
        style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}
      >
        <p>
          © {new Date().getFullYear()} Ascentor Inc. ·{' '}
          <Link href="/terms">Terms</Link> ·{' '}
          <Link href="/blog">Blog</Link> ·{' '}
          <Link href="/pricing">Pricing</Link>
        </p>
      </footer>
    </div>
  );
}
