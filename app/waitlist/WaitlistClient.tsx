'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
type LifeStage      = 'explorer' | 'builder' | 'climber';
type ReferralSource = 'instagram' | 'tiktok' | 'linkedin' | 'whatsapp' | 'friend' | 'other';

interface ProofPoint { emoji: string; title: string; desc: string; }
interface Avatar     { initial: string; bg: string; }

interface FormData {
  first_name:      string;
  last_name:       string;
  email:           string;
  whatsapp:        string;
  life_stage:      LifeStage;
  country:         string;
  industry:        string;
  referral_source: ReferralSource | '';
  consent:         boolean;
}

interface FormErrors {
  first_name?:  string;
  last_name?:   string;
  email?:       string;
  whatsapp?:    string;
  country?:     string;
  life_stage?:  string;
  consent?:     string;
}

interface SuccessData { position: number; referral_code: string; }

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const LIFE_STAGES = [
  { value: 'explorer' as LifeStage, emoji: '🌱', label: 'Explorer', age: '15–22' },
  { value: 'builder'  as LifeStage, emoji: '🚀', label: 'Builder',  age: '22–32' },
  { value: 'climber'  as LifeStage, emoji: '⚡', label: 'Climber',  age: '32–50' },
];

const REFERRAL_SOURCES = [
  { value: 'instagram' as ReferralSource, label: '📸 Instagram' },
  { value: 'tiktok'    as ReferralSource, label: '🎵 TikTok'    },
  { value: 'linkedin'  as ReferralSource, label: '💼 LinkedIn'  },
  { value: 'whatsapp'  as ReferralSource, label: '💬 WhatsApp'  },
  { value: 'friend'    as ReferralSource, label: '👤 A Friend'  },
  { value: 'other'     as ReferralSource, label: '🌐 Other'     },
];

const COUNTRIES = [
  { code: 'NG',           label: '🇳🇬 Nigeria'          },
  { code: 'GH',           label: '🇬🇭 Ghana'            },
  { code: 'KE',           label: '🇰🇪 Kenya'            },
  { code: 'ZA',           label: '🇿🇦 South Africa'     },
  { code: 'ET',           label: '🇪🇹 Ethiopia'         },
  { code: 'TZ',           label: '🇹🇿 Tanzania'         },
  { code: 'UG',           label: '🇺🇬 Uganda'           },
  { code: 'SN',           label: '🇸🇳 Senegal'          },
  { code: 'CI',           label: "🇨🇮 Côte d'Ivoire"   },
  { code: 'CM',           label: '🇨🇲 Cameroon'         },
  { code: 'RW',           label: '🇷🇼 Rwanda'           },
  { code: 'ZM',           label: '🇿🇲 Zambia'           },
  { code: 'DIASPORA-UK',  label: '🇬🇧 UK (Diaspora)'   },
  { code: 'DIASPORA-US',  label: '🇺🇸 US (Diaspora)'   },
  { code: 'DIASPORA-CA',  label: '🇨🇦 Canada (Diaspora)'},
  { code: 'OTHER',        label: '🌍 Other Africa'       },
];

const INDUSTRIES = [
  { value: 'fintech',     label: 'Fintech / Finance'           },
  { value: 'tech',        label: 'Technology'                  },
  { value: 'consulting',  label: 'Consulting / Strategy'       },
  { value: 'healthcare',  label: 'Healthcare'                  },
  { value: 'education',   label: 'Education'                   },
  { value: 'fmcg',        label: 'FMCG / Retail'               },
  { value: 'media',       label: 'Media / Creative'            },
  { value: 'startup',     label: 'Startup / Entrepreneurship'  },
  { value: 'government',  label: 'Government / Public Sector'  },
  { value: 'ngo',         label: 'NGO / Development'           },
  { value: 'law',         label: 'Legal / Law'                 },
  { value: 'engineering', label: 'Engineering'                 },
  { value: 'other',       label: 'Other'                       },
];

/* ─────────────────────────────────────────────────────────────
   Inline style tokens (matching HTML CSS vars)
───────────────────────────────────────────────────────────── */
const C = {
  gold:          '#E8A020',
  goldLight:     '#F5C55A',
  goldDim:       'rgba(232,160,32,0.15)',
  dark:          '#0C0B08',
  dark2:         '#141310',
  dark3:         '#1E1C17',
  dark4:         '#252219',
  textPrimary:   '#F5F0E8',
  textSecondary: 'rgba(245,240,232,0.55)',
  textMuted:     'rgba(245,240,232,0.28)',
  border:        'rgba(245,240,232,0.07)',
  borderGold:    'rgba(232,160,32,0.25)',
  green:         '#4ade80',
  red:           '#ef4444',
};

/* ─────────────────────────────────────────────────────────────
   Validation
───────────────────────────────────────────────────────────── */
function validate(f: FormData): FormErrors {
  const e: FormErrors = {};
  if (!f.first_name.trim())  e.first_name = 'Required';
  if (!f.last_name.trim())   e.last_name  = 'Required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
                             e.email      = 'Enter a valid email';
  if (!f.whatsapp.trim() || !/^\+?[0-9\s\-]{7,20}$/.test(f.whatsapp.trim()))
                             e.whatsapp   = 'Enter a valid WhatsApp number';
  if (!f.country)            e.country    = 'Required';
  if (!f.life_stage)         e.life_stage = 'Please select your stage';
  if (!f.consent)            e.consent    = 'Please accept to continue';
  return e;
}

/* ─────────────────────────────────────────────────────────────
   Shared input styles
───────────────────────────────────────────────────────────── */
function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: hasError ? 'rgba(239,68,68,0.06)' : C.dark3,
    border: `1.5px solid ${hasError ? C.red : C.border}`,
    borderRadius: '10px',
    padding: '13px 15px',
    fontSize: '14px',
    color: C.textPrimary,
    fontFamily: "'Syne', sans-serif",
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    WebkitAppearance: 'none' as const,
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.11em',
  textTransform: 'uppercase' as const,
  color: C.textSecondary,
  marginBottom: '6px',
};

const errorStyle: React.CSSProperties = {
  fontSize: '11px',
  color: C.red,
  marginTop: '4px',
};

const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(245,240,232,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

/* ─────────────────────────────────────────────────────────────
   Particle canvas hook
───────────────────────────────────────────────────────────── */
function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, rafId = 0;

    interface Particle { x:number; y:number; r:number; dx:number; dy:number; o:number; }
    let particles: Particle[] = [];

    function resize() {
      W = canvas!.width  = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    function init() {
      particles = Array.from({ length: 60 }, () => ({
        x:  Math.random() * W,
        y:  Math.random() * H,
        r:  Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o:  Math.random() * 0.4 + 0.1,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      particles.forEach(p => {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(232,160,32,${p.o})`;
        ctx!.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(232,160,32,${0.06 * (1 - dist / 120)})`;
            ctx!.lineWidth   = 0.5;
            ctx!.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    }

    resize(); init(); draw();
    const onResize = () => { resize(); init(); };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); };
  }, [canvasRef]);
}

/* ─────────────────────────────────────────────────────────────
   Counter animation hook
───────────────────────────────────────────────────────────── */
function useCounter(target: number, delay = 800) {
  const [count, setCount] = useState(target - 20);
  useEffect(() => {
    const timer = setTimeout(() => {
      let cur = target - 20;
      const iv = setInterval(() => {
        cur++;
        setCount(cur);
        if (cur >= target) clearInterval(iv);
      }, 60);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, delay]);
  return count;
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export default function WaitlistClient({
  proofPoints,
  avatars,
}: {
  proofPoints: ProofPoint[];
  avatars:     Avatar[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticleCanvas(canvasRef);
  const count = useCounter(247);

  const [form, setForm]           = useState<FormData>({
    first_name: '', last_name: '', email: '', whatsapp: '',
    life_stage: 'builder', country: '', industry: '',
    referral_source: '', consent: false,
  });
  const [errors, setErrors]       = useState<FormErrors>({});
  const [loading, setLoading]     = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess]     = useState<SuccessData | null>(null);
  const [copied, setCopied]       = useState(false);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      const params  = new URLSearchParams(window.location.search);
      const payload = {
        ...form,
        email:        form.email.trim().toLowerCase(),
        whatsapp:     form.whatsapp.trim(),
        utm_source:   params.get('utm_source')   ?? undefined,
        utm_medium:   params.get('utm_medium')   ?? undefined,
        utm_campaign: params.get('utm_campaign') ?? undefined,
        landing_page: window.location.pathname,
      };
      const res  = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok || res.status === 409) {
        setSuccess({ position: data.position ?? 248, referral_code: data.referral_code ?? '' });
      } else {
        setServerError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  async function copyLink() {
    const link = `${window.location.origin}/waitlist?ref=${success?.referral_code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  /* ── Success state ── */
  if (success) {
    const shareText = encodeURIComponent(
      "I just joined the Ascentor waitlist — Africa's mentorship platform. Early members get 3 months free. Join me 👇"
    );
    const shareUrl = encodeURIComponent(
      `${typeof window !== 'undefined' ? window.location.origin : 'https://ascentor.co'}/waitlist?ref=${success.referral_code}`
    );
    const rawUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://ascentor.co'}/waitlist?ref=${success.referral_code}`;

    return (
      <>
        <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:2, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
          <div style={{
            width:'100%', maxWidth:'440px',
            display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
            animation:'fadeUp 0.6s ease both',
          }}>
            {/* Icon */}
            <div style={{
              width:80, height:80, borderRadius:'50%', fontSize:36,
              background: C.goldDim, border:`1.5px solid ${C.borderGold}`,
              display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28,
            }}>🎉</div>

            <h2 style={{
              fontFamily:"'Cormorant Garamond', serif",
              fontSize:38, fontWeight:700, lineHeight:1.1,
              color: C.textPrimary, marginBottom:14,
            }}>
              You&apos;re in,<br />
              <em style={{ color: C.gold, fontStyle:'italic' }}>officially.</em>
            </h2>
            <p style={{ fontSize:15, lineHeight:1.7, color: C.textSecondary, marginBottom:32, maxWidth:340 }}>
              Welcome to the Ascentor waitlist. Check your inbox — a confirmation is on its way.
              Your mentor is almost ready for you.
            </p>

            {/* Position card */}
            <div style={{
              width:'100%', background: C.dark3,
              border:`1px solid ${C.borderGold}`,
              borderRadius:16, padding:'24px 28px',
              marginBottom:28, position:'relative', overflow:'hidden',
            }} className="position-card-line">
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color: C.textMuted, marginBottom:8 }}>
                Your Waitlist Position
              </p>
              <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:56, fontWeight:700, color: C.gold, lineHeight:1, marginBottom:4 }}>
                #{success.position}
              </p>
              <p style={{ fontSize:13, color: C.textMuted }}>
                Early members get 3 months free · No credit card needed
              </p>
            </div>

            {/* Share */}
            <div style={{ width:'100%' }}>
              <p style={{ fontSize:13, fontWeight:600, color: C.textSecondary, marginBottom:14, textAlign:'center' }}>
                Move up the list — share with someone who needs this 🚀
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <a href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    padding:'12px 14px', borderRadius:10, textDecoration:'none',
                    border:`1.5px solid ${C.border}`, background: C.dark3,
                    fontSize:13, fontWeight:600, color: C.textSecondary,
                    transition:'border-color 0.2s, color 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor='#25D366'; (e.currentTarget as HTMLAnchorElement).style.color='#25D366'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor=C.border; (e.currentTarget as HTMLAnchorElement).style.color=C.textSecondary; }}
                >
                  💬 WhatsApp
                </a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    padding:'12px 14px', borderRadius:10, textDecoration:'none',
                    border:`1.5px solid ${C.border}`, background: C.dark3,
                    fontSize:13, fontWeight:600, color: C.textSecondary,
                    transition:'border-color 0.2s, color 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor='#0A66C2'; (e.currentTarget as HTMLAnchorElement).style.color='#0A66C2'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor=C.border; (e.currentTarget as HTMLAnchorElement).style.color=C.textSecondary; }}
                >
                  💼 LinkedIn
                </a>
              </div>
              {/* Copy link */}
              <div style={{ display:'flex', borderRadius:10, overflow:'hidden', border:`1.5px solid ${C.border}` }}>
                <span style={{
                  flex:1, padding:'11px 14px', fontSize:12,
                  color: C.textMuted, background: C.dark4,
                  fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>
                  {rawUrl}
                </span>
                <button onClick={copyLink} style={{
                  padding:'11px 18px', fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                  borderLeft:`1.5px solid ${C.border}`, whiteSpace:'nowrap', fontFamily:"'Syne', sans-serif",
                  background: copied ? C.gold : C.goldDim,
                  color:      copied ? C.dark : C.gold,
                  transition:'all 0.2s',
                }}>
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            <Link href="/" style={{ marginTop:24, fontSize:12, color: C.textMuted, textDecoration:'underline' }}>
              Back to homepage
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        `}</style>
      </>
    );
  }

  /* ── Form state ── */
  return (
    <>
      {/* Animated particle canvas */}
      <canvas
        ref={canvasRef}
        style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}
        aria-hidden="true"
      />

      {/* Two-panel grid */}
      <div
        className="split-layout"
        style={{
          position:'relative', zIndex:2,
          minHeight:'100vh',
          display:'grid',
          gridTemplateColumns:'1fr 1fr',
        }}
      >
        {/* ══ LEFT PANEL ══ */}
        <div
          className="left-panel"
          style={{
            display:'flex', flexDirection:'column', justifyContent:'space-between',
            padding:'52px 56px', minHeight:'100vh',
            borderRight:`1px solid ${C.border}`,
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{
              width:36, height:36, borderRadius:8, background: C.gold,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'Cormorant Garamond', serif", fontSize:20, fontWeight:700, color: C.dark,
            }}>A</div>
            <span style={{ fontSize:18, fontWeight:700, color: C.textPrimary, letterSpacing:'-0.01em' }}>
              Ascentor
            </span>
          </Link>

          {/* Middle content */}
          <div className="left-content" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 0' }}>

            {/* Eyebrow */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:32 }}>
              <div style={{ width:32, height:1.5, background: C.gold }} />
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color: C.gold }}>
                Coming Soon — Join the Waitlist
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily:"'Cormorant Garamond', serif",
              fontSize:'clamp(48px, 5.5vw, 80px)',
              fontWeight:700, lineHeight:1.0,
              color: C.textPrimary, marginBottom:28,
            }}>
              Your<br />
              <em style={{ fontStyle:'italic', color: C.gold }}>mentor</em><br />
              is waiting.
            </h1>

            {/* Sub */}
            <p style={{ fontSize:16, lineHeight:1.75, color: C.textSecondary, maxWidth:420, marginBottom:48 }}>
              Africa&apos;s mentorship platform — built for{' '}
              <strong style={{ color: C.textPrimary }}>every stage of your journey.</strong>{' '}
              From figuring out what to do with your life, to reaching the very top of your career.
            </p>

            {/* Proof points */}
            <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:52 }}>
              {proofPoints.map(p => (
                <div key={p.title} style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0, marginTop:1,
                    background: C.goldDim, border:`1px solid ${C.borderGold}`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                  }}>
                    {p.emoji}
                  </div>
                  <div style={{ fontSize:14, lineHeight:1.6, color: C.textSecondary }}>
                    <strong style={{ color: C.textPrimary, fontWeight:600, display:'block', marginBottom:2 }}>
                      {p.title}
                    </strong>
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Counter block */}
            <div
              className="counter-block"
              style={{
                display:'flex', alignItems:'center', gap:20,
                padding:'20px 24px', background: C.dark3,
                borderRadius:14, border:`1px solid ${C.border}`,
                position:'relative', overflow:'hidden',
              }}
            >
              {/* Stacked avatars */}
              <div style={{ display:'flex' }}>
                {avatars.map((a, i) => (
                  <div key={i} style={{
                    width:34, height:34, borderRadius:'50%',
                    border:`2px solid ${C.dark3}`,
                    marginRight:-10,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700, color: C.dark,
                    background: a.bg, flexShrink:0,
                  }}>
                    {a.initial}
                  </div>
                ))}
              </div>

              {/* Text */}
              <div style={{ fontSize:13, color: C.textSecondary, lineHeight:1.5 }}>
                <strong style={{ color: C.textPrimary, fontWeight:700 }}>{count} people</strong>{' '}
                already on the waitlist<br />across 15 African countries
              </div>

              {/* Live badge */}
              <div style={{
                marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
                fontSize:11, fontWeight:600, color: C.green,
                textTransform:'uppercase', letterSpacing:'0.08em', flexShrink:0,
              }}>
                <div className="live-dot" style={{
                  width:6, height:6, borderRadius:'50%', background: C.green,
                }} />
                Live
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div style={{ paddingTop:24, borderTop:`1px solid ${C.border}` }}>
            <p style={{ fontSize:12, color: C.textMuted, lineHeight:1.5 }}>
              Early members get{' '}
              <strong style={{ color: C.gold }}>3 months free</strong>{' '}
              on launch · No spam, ever · Unsubscribe anytime
            </p>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div
          className="right-panel right-glow-top right-glow-bottom"
          style={{
            display:'flex', flexDirection:'column', justifyContent:'center',
            padding:'52px 56px',
            background: C.dark2,
            position:'relative', overflow:'hidden',
          }}
        >
          <div style={{ position:'relative', zIndex:1, maxWidth:440, width:'100%', margin:'0 auto' }}>

            {/* Form header */}
            <div style={{ marginBottom:32 }}>
              {/* Step dots */}
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width:8, height:8, borderRadius:'50%',
                    background: i === 0 ? C.gold : C.borderGold,
                    boxShadow: i === 0 ? `0 0 8px rgba(232,160,32,0.5)` : 'none',
                  }} />
                ))}
              </div>
              <h2 style={{
                fontFamily:"'Cormorant Garamond', serif",
                fontSize:34, fontWeight:700, color: C.textPrimary,
                lineHeight:1.15, marginBottom:10,
              }}>
                Secure your<br />early access.
              </h2>
              <p style={{ fontSize:14, color: C.textSecondary }}>
                Takes 60 seconds. Early members get 3 months free on launch.
              </p>
            </div>

            {/* ── FORM ── */}
            <form onSubmit={handleSubmit} noValidate>

              {/* Name row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input
                    id="first_name" type="text" placeholder="Temi" autoComplete="given-name"
                    value={form.first_name} onChange={e => set('first_name', e.target.value)}
                    style={inputStyle(!!errors.first_name)}
                    onFocus={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(232,160,32,0.1)`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = errors.first_name ? C.red : C.border; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  {errors.first_name && <p style={errorStyle}>{errors.first_name}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    id="last_name" type="text" placeholder="Adeyemi" autoComplete="family-name"
                    value={form.last_name} onChange={e => set('last_name', e.target.value)}
                    style={inputStyle(!!errors.last_name)}
                    onFocus={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(232,160,32,0.1)`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = errors.last_name ? C.red : C.border; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  {errors.last_name && <p style={errorStyle}>{errors.last_name}</p>}
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>Email Address</label>
                <input
                  id="email" type="email" placeholder="temi@email.com" autoComplete="email"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  style={inputStyle(!!errors.email)}
                  onFocus={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(232,160,32,0.1)`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = errors.email ? C.red : C.border; e.currentTarget.style.boxShadow = 'none'; }}
                />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>

              {/* WhatsApp */}
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>WhatsApp Number</label>
                <input
                  id="whatsapp" type="tel" placeholder="+234 801 234 5678" autoComplete="tel"
                  value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
                  style={inputStyle(!!errors.whatsapp)}
                  onFocus={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(232,160,32,0.1)`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = errors.whatsapp ? C.red : C.border; e.currentTarget.style.boxShadow = 'none'; }}
                />
                {errors.whatsapp && <p style={errorStyle}>{errors.whatsapp}</p>}
              </div>

              {/* Life Stage */}
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>Your Life Stage</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {LIFE_STAGES.map(s => {
                    const active = form.life_stage === s.value;
                    return (
                      <button
                        key={s.value} type="button"
                        onClick={() => set('life_stage', s.value)}
                        style={{
                          display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                          padding:'14px 10px', borderRadius:10, cursor:'pointer',
                          background: active ? C.goldDim : C.dark3,
                          border: `1.5px solid ${active ? C.gold : C.border}`,
                          boxShadow: active ? `0 0 0 3px rgba(232,160,32,0.1)` : 'none',
                          transition:'all 0.2s',
                        }}
                      >
                        <span style={{ fontSize:20 }}>{s.emoji}</span>
                        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color: active ? C.gold : C.textSecondary }}>
                          {s.label}
                        </span>
                        <span style={{ fontSize:10, color: C.textMuted }}>{s.age}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.life_stage && <p style={errorStyle}>{errors.life_stage}</p>}
              </div>

              {/* Country + Industry */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={labelStyle}>Country</label>
                  <select
                    id="country" value={form.country}
                    onChange={e => set('country', e.target.value)}
                    style={{
                      ...inputStyle(!!errors.country),
                      backgroundImage: chevronBg,
                      backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center',
                      paddingRight:40, cursor:'pointer',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(232,160,32,0.1)`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = errors.country ? C.red : C.border; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code} style={{ background: C.dark3 }}>{c.label}</option>)}
                  </select>
                  {errors.country && <p style={errorStyle}>{errors.country}</p>}
                </div>
                <div>
                  <label style={labelStyle}>
                    Industry{' '}
                    <span style={{ color: C.textMuted, fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optional)</span>
                  </label>
                  <select
                    id="industry" value={form.industry}
                    onChange={e => set('industry', e.target.value)}
                    style={{
                      ...inputStyle(false),
                      backgroundImage: chevronBg,
                      backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center',
                      paddingRight:40, cursor:'pointer',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(232,160,32,0.1)`; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="">Your industry</option>
                    {INDUSTRIES.map(i => <option key={i.value} value={i.value} style={{ background: C.dark3 }}>{i.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Referral source */}
              <div style={{ marginBottom:20 }}>
                <label style={labelStyle}>
                  How did you hear about us?{' '}
                  <span style={{ color: C.textMuted, fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optional)</span>
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {REFERRAL_SOURCES.map(s => {
                    const active = form.referral_source === s.value;
                    return (
                      <button
                        key={s.value} type="button"
                        onClick={() => set('referral_source', active ? '' : s.value)}
                        style={{
                          padding:'10px 8px', borderRadius:8, cursor:'pointer',
                          fontSize:12, fontWeight:500, textAlign:'center',
                          background: active ? C.goldDim : C.dark3,
                          border: `1.5px solid ${active ? C.gold : C.border}`,
                          color: active ? C.gold : C.textSecondary,
                          transition:'all 0.2s',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consent */}
              <label style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:20, cursor:'pointer' }}>
                <input
                  id="consent" type="checkbox" checked={form.consent}
                  onChange={e => set('consent', e.target.checked)}
                  style={{ width:16, height:16, marginTop:2, flexShrink:0, accentColor: C.gold, cursor:'pointer' }}
                />
                <span style={{ fontSize:12, lineHeight:1.6, color: C.textMuted }}>
                  I agree to receive updates about Ascentor&apos;s launch and early access offers.
                  No spam — ever. View our{' '}
                  <Link href="/terms" style={{ color: C.gold, textDecoration:'none' }}>Privacy Policy</Link>.
                </span>
              </label>
              {errors.consent && <p style={{ ...errorStyle, marginTop:-14, marginBottom:12 }}>{errors.consent}</p>}

              {/* Server error */}
              {serverError && (
                <div style={{
                  fontSize:12, padding:'12px 14px', borderRadius:8, marginBottom:16,
                  background:'rgba(239,68,68,0.08)', border:`1px solid rgba(239,68,68,0.25)`, color:'#fca5a5',
                }}>
                  {serverError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                style={{
                  width:'100%', padding:'17px 28px', borderRadius:12, border:'none',
                  fontSize:15, fontWeight:800, letterSpacing:'0.02em', cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily:"'Syne', sans-serif",
                  background: loading ? 'rgba(232,160,32,0.55)' : C.gold,
                  color: C.dark,
                  boxShadow: loading ? 'none' : '0 8px 32px rgba(232,160,32,0.4)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  transition:'all 0.25s',
                }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = C.goldLight; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = loading ? 'rgba(232,160,32,0.55)' : C.gold; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
              >
                {loading ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                      style={{ animation:'spin 0.7s linear infinite' }}>
                      <circle cx="9" cy="9" r="7" stroke="rgba(15,14,11,0.3)" strokeWidth="2"/>
                      <path d="M9 2a7 7 0 0 1 7 7" stroke={C.dark} strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Securing your spot...
                  </>
                ) : (
                  <>Secure My Spot <span style={{ fontSize:18, transition:'transform 0.2s' }}>→</span></>
                )}
              </button>

              {/* Trust row */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:20,
                marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}`,
              }}>
                {[['🔒','Secure & private'],['🎁','3 months free'],['✨','No spam, ever']].map(([icon,text]) => (
                  <div key={text} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13 }}>{icon}</span>
                    <span style={{ fontSize:11, color: C.textMuted }}>{text}</span>
                  </div>
                ))}
              </div>

            </form>
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </>
  );
}
