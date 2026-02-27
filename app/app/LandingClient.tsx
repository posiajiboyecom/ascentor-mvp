'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// ═══ PARTICLE SYSTEM — community feel ═══
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let w = 0, h = 0;

    const COLORS = ['#E8A020', '#14B8A6', '#8B5CF6', '#3B82F6', '#EF4444', '#10B981'];

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      r: number; color: string; baseX: number; baseY: number;
    }

    let particles: Particle[] = [];

    function resize() {
      w = canvas!.width = canvas!.offsetWidth * window.devicePixelRatio;
      h = canvas!.height = canvas!.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      init();
    }

    function init() {
      const count = Math.min(Math.floor((canvas!.offsetWidth * canvas!.offsetHeight) / 8000), 80);
      particles = Array.from({ length: count }, () => {
        const x = Math.random() * canvas!.offsetWidth;
        const y = Math.random() * canvas!.offsetHeight;
        return {
          x, y, baseX: x, baseY: y,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 3 + 1.5,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse repel/attract
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          p.vx -= (dx / dist) * force * 0.3;
          p.vy -= (dy / dist) * force * 0.3;
        }

        // Spring back to base
        p.vx += (p.baseX - p.x) * 0.005;
        p.vy += (p.baseY - p.y) * 0.005;

        // Damping
        p.vx *= 0.97;
        p.vy *= 0.97;

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const d = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - d / 120) * 0.15;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    function handleMouse(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function handleTouch(e: TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const t = e.touches[0];
      mouse.current = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    function handleLeave() {
      mouse.current = { x: -1000, y: -1000 };
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('touchmove', handleTouch, { passive: true });
    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'auto' }} />
  );
}

// ═══ COUNTER ANIMATION ═══
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0;
        const step = Math.max(1, Math.floor(target / 40));
        const timer = setInterval(() => {
          start += step;
          if (start >= target) { setVal(target); clearInterval(timer); }
          else setVal(start);
        }, 30);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ═══ MAIN ═══
export default function LandingClient() {
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSubStatus('done');
    } catch { setSubStatus('done'); }
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', color: '#1A1A1A', fontFamily: "'Syne', system-ui, sans-serif" }}>

      {/* ═══ NAV ═══ */}
      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl" style={{ color: '#E8A020' }}>⬆</span>
            <span className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Ascentor</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: '#6B7280' }}>
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
            <Link href="/login" className="hover:text-gray-900 transition-colors">Log In</Link>
            <Link href="/signup"
              className="px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#E8A020', color: '#000' }}>
              Start Free Trial
            </Link>
          </div>
          <Link href="/signup" className="md:hidden px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden" style={{ minHeight: '85vh' }}>
        <ParticleCanvas />
        <div className="relative z-10 max-w-4xl mx-auto px-5 pt-20 pb-16 lg:pt-32 lg:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            Now in beta — join 50+ early leaders
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold mb-5 leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
            Your AI leadership<br />
            coach for <span style={{ color: '#E8A020' }}>Africa</span>
          </h1>
          <p className="text-base md:text-lg max-w-2xl mx-auto mb-8" style={{ color: '#6B7280', lineHeight: 1.7 }}>
            AI coaching, live expert sessions, and peer accountability cohorts — built for ambitious African professionals who refuse to wait for permission to lead.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/signup"
              className="px-8 py-4 rounded-xl text-base font-semibold transition-transform hover:scale-105"
              style={{ background: '#E8A020', color: '#000' }}>
              Start 7-Day Free Trial →
            </Link>
            <Link href="/pricing"
              className="px-8 py-4 rounded-xl text-base font-semibold transition-colors"
              style={{ border: '1.5px solid #E5E5E4', color: '#374151' }}>
              View Pricing
            </Link>
          </div>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>No credit card required · Cancel anytime · 30-day money-back guarantee</p>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section className="py-12" style={{ background: '#F5F5F4' }}>
        <div className="max-w-5xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 95, suffix: '%', label: 'Report career clarity' },
              { value: 50, suffix: '+', label: 'Early access members' },
              { value: 24, suffix: '/7', label: 'AI coaching available' },
              { value: 15, suffix: '', label: 'Countries represented' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#E8A020' }}>
                  <AnimatedNumber target={s.value} suffix={s.suffix} />
                </div>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3 PILLARS ═══ */}
      <section className="py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold mb-3"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
              Three pillars, one platform
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#6B7280' }}>
              Everything you need to accelerate your leadership journey — at a fraction of the cost of traditional coaching.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: '🤖', title: 'AI Coaching', color: '#E8A020',
                desc: 'A Socratic coach trained on leadership frameworks and African business context. Ask anything at 2am before your big meeting.',
                features: ['Personalized to your career stage', 'GROW model + African context', 'Action items after every session'],
              },
              {
                icon: '🎓', title: 'Expert Sessions', color: '#8B5CF6',
                desc: 'Live workshops with real African leaders who\'ve navigated the exact challenges you face. Not theory — lived experience.',
                features: ['Monthly live workshops', 'Q&A with industry leaders', 'Recordings library access'],
              },
              {
                icon: '👥', title: 'Peer Cohorts', color: '#14B8A6',
                desc: '15-person accountability groups matched by industry and career stage. Your personal board of advisors.',
                features: ['Matched by industry & stage', 'Weekly check-ins', 'Shared goal tracking'],
              },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl p-7 transition-all hover:-translate-y-1"
                style={{ background: '#fff', border: '1px solid #E5E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: `${p.color}12` }}>
                  {p.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
                  {p.title}
                </h3>
                <p className="text-sm mb-4" style={{ color: '#6B7280', lineHeight: 1.7 }}>{p.desc}</p>
                <div className="flex flex-col gap-2">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                      <span style={{ color: p.color }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-16 lg:py-24" style={{ background: '#F5F5F4' }}>
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
            Start leading in 3 steps
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Take the assessment', desc: 'Tell us about your role, goals, and biggest challenge. Our AI matches you to the right frameworks and cohort.' },
              { step: '02', title: 'Get your first insight', desc: 'Within 60 seconds, your AI coach gives you a personalized action plan based on proven leadership models.' },
              { step: '03', title: 'Grow with your cohort', desc: 'Join 15 peers on the same journey. Share wins, get feedback, and hold each other accountable weekly.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#E8A020', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  {s.step}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: '#0C0B08' }}>{s.title}</h3>
                <p className="text-sm" style={{ color: '#6B7280', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
            What early members say
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { quote: 'The AI coach helped me prepare for a promotion conversation I\'d been avoiding for months. I got the promotion.', name: 'Amara O.', role: 'Product Manager, Lagos' },
              { quote: 'Having a cohort of peers in similar roles across Africa gave me perspectives I never would have found in my company alone.', name: 'David K.', role: 'Engineering Lead, Nairobi' },
              { quote: 'At $15/month, this replaces the $200/session executive coach I couldn\'t afford to keep. The AI is surprisingly nuanced.', name: 'Fatima H.', role: 'Strategy Consultant, Accra' },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl p-6"
                style={{ background: '#fff', border: '1px solid #E5E5E4' }}>
                <div className="text-2xl mb-3" style={{ color: '#E8A020' }}>"</div>
                <p className="text-sm mb-4" style={{ color: '#374151', lineHeight: 1.7 }}>{t.quote}</p>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0C0B08' }}>{t.name}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-16 lg:py-24" style={{ background: '#0C0B08' }}>
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F3F4F6' }}>
            Ready to lead?
          </h2>
          <p className="text-base mb-8" style={{ color: '#9CA3AF' }}>
            Join ambitious professionals across Africa who are investing in their leadership growth. Start your free trial today.
          </p>
          <Link href="/signup"
            className="inline-block px-10 py-4 rounded-xl text-base font-semibold transition-transform hover:scale-105"
            style={{ background: '#E8A020', color: '#000' }}>
            Start 7-Day Free Trial →
          </Link>

          {/* Newsletter */}
          <div className="mt-12 pt-8" style={{ borderTop: '1px solid #1F2937' }}>
            <p className="text-sm mb-3" style={{ color: '#9CA3AF' }}>Not ready yet? Get leadership insights weekly.</p>
            {subStatus === 'done' ? (
              <p className="text-sm font-semibold" style={{ color: '#10B981' }}>✓ You're in! Check your inbox.</p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-4 py-3 rounded-lg text-sm"
                  style={{ background: '#111827', color: '#F3F4F6', border: '1px solid #1F2937', outline: 'none' }}
                />
                <button type="submit" disabled={subStatus === 'loading'}
                  className="px-5 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#E8A020', color: '#000' }}>
                  {subStatus === 'loading' ? '...' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-10" style={{ background: '#0C0B08', borderTop: '1px solid #1F2937' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: '#E8A020' }}>⬆</span>
                <span className="font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F3F4F6' }}>Ascentor</span>
              </div>
              <p className="text-xs" style={{ color: '#6B7280' }}>Leadership development for Africa's next generation.</p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: '#9CA3AF' }}>Product</p>
              <div className="flex flex-col gap-2">
                <Link href="/pricing" className="text-xs" style={{ color: '#6B7280' }}>Pricing</Link>
                <Link href="/blog" className="text-xs" style={{ color: '#6B7280' }}>Blog</Link>
                <Link href="/signup" className="text-xs" style={{ color: '#6B7280' }}>Start Free Trial</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: '#9CA3AF' }}>Company</p>
              <div className="flex flex-col gap-2">
                <Link href="/terms" className="text-xs" style={{ color: '#6B7280' }}>Terms & Conditions</Link>
                <Link href="/newsletter" className="text-xs" style={{ color: '#6B7280' }}>Newsletter</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: '#9CA3AF' }}>Connect</p>
              <div className="flex flex-col gap-2">
                <a href="mailto:hello@ascentor.co" className="text-xs" style={{ color: '#6B7280' }}>hello@ascentor.co</a>
                <a href="https://twitter.com/ascentor" className="text-xs" style={{ color: '#6B7280' }}>Twitter/X</a>
                <a href="https://linkedin.com/company/ascentor" className="text-xs" style={{ color: '#6B7280' }}>LinkedIn</a>
              </div>
            </div>
          </div>
          <div className="pt-6 text-center text-xs" style={{ borderTop: '1px solid #1F2937', color: '#6B7280' }}>
            © {new Date().getFullYear()} Ascentor Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
