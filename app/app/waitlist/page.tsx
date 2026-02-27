'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

/* ─── TYPES ─────────────────────────────────────────────── */
type LifeStage      = 'explorer' | 'builder' | 'climber';
type ReferralSource = 'instagram' | 'tiktok' | 'linkedin' | 'whatsapp' | 'friend' | 'other';

interface FormState {
  first_name: string; last_name: string; email: string; whatsapp: string;
  life_stage: LifeStage; country: string; industry: string;
  referral_source: ReferralSource | ''; consent: boolean;
}
interface FormErrors {
  first_name?: string; last_name?: string; email?: string;
  whatsapp?: string; country?: string; life_stage?: string; consent?: string;
}
interface SuccessData { position: number; referral_code: string; }

/* ─── CONSTANTS ─────────────────────────────────────────── */
const STAGES = [
  { value: 'explorer' as LifeStage, emoji: '🌱', label: 'Explorer', age: '15–22' },
  { value: 'builder'  as LifeStage, emoji: '🚀', label: 'Builder',  age: '22–32' },
  { value: 'climber'  as LifeStage, emoji: '⚡', label: 'Climber',  age: '32–50' },
];
const SOURCES = [
  { value: 'instagram' as ReferralSource, label: '📸 Instagram' },
  { value: 'tiktok'    as ReferralSource, label: '🎵 TikTok'    },
  { value: 'linkedin'  as ReferralSource, label: '💼 LinkedIn'  },
  { value: 'whatsapp'  as ReferralSource, label: '💬 WhatsApp'  },
  { value: 'friend'    as ReferralSource, label: '👤 A Friend'  },
  { value: 'other'     as ReferralSource, label: '🌐 Other'     },
];
const COUNTRIES = [
  { code: 'NG', label: '🇳🇬 Nigeria' }, { code: 'GH', label: '🇬🇭 Ghana' },
  { code: 'KE', label: '🇰🇪 Kenya' }, { code: 'ZA', label: '🇿🇦 South Africa' },
  { code: 'ET', label: '🇪🇹 Ethiopia' }, { code: 'TZ', label: '🇹🇿 Tanzania' },
  { code: 'UG', label: '🇺🇬 Uganda' }, { code: 'SN', label: '🇸🇳 Senegal' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" }, { code: 'CM', label: '🇨🇲 Cameroon' },
  { code: 'RW', label: '🇷🇼 Rwanda' }, { code: 'ZM', label: '🇿🇲 Zambia' },
  { code: 'DIASPORA-UK', label: '🇬🇧 UK (Diaspora)' },
  { code: 'DIASPORA-US', label: '🇺🇸 US (Diaspora)' },
  { code: 'DIASPORA-CA', label: '🇨🇦 Canada (Diaspora)' },
  { code: 'OTHER', label: '🌍 Other Africa' },
];
const INDUSTRIES = [
  { value: 'fintech',    label: 'Fintech / Finance' },
  { value: 'tech',       label: 'Technology' },
  { value: 'consulting', label: 'Consulting / Strategy' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education',  label: 'Education' },
  { value: 'fmcg',       label: 'FMCG / Retail' },
  { value: 'media',      label: 'Media / Creative' },
  { value: 'startup',    label: 'Startup / Entrepreneurship' },
  { value: 'government', label: 'Government / Public Sector' },
  { value: 'ngo',        label: 'NGO / Development' },
  { value: 'law',        label: 'Legal / Law' },
  { value: 'engineering',label: 'Engineering' },
  { value: 'other',      label: 'Other' },
];
const AVATARS = [
  { i: 'T', bg: 'linear-gradient(135deg,#E8A020,#C87020)' },
  { i: 'A', bg: 'linear-gradient(135deg,#C87020,#A05010)' },
  { i: 'K', bg: 'linear-gradient(135deg,#F5C55A,#E8A020)' },
  { i: 'F', bg: 'linear-gradient(135deg,#A05010,#804000)' },
  { i: '+', bg: 'linear-gradient(135deg,#E8A020,#804000)' },
];

/* ─── VALIDATION ────────────────────────────────────────── */
function validate(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.first_name.trim())  e.first_name = 'Required';
  if (!f.last_name.trim())   e.last_name  = 'Required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email';
  if (!f.whatsapp.trim() || !/^\+?[0-9\s\-]{7,20}$/.test(f.whatsapp.trim())) e.whatsapp = 'Enter a valid WhatsApp number';
  if (!f.country)   e.country   = 'Required';
  if (!f.life_stage) e.life_stage = 'Please select your stage';
  if (!f.consent)   e.consent   = 'Please accept to continue';
  return e;
}

/* ─── MAIN COMPONENT ────────────────────────────────────── */
export default function WaitlistPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(227);
  const [form, setForm] = useState<FormState>({
    first_name: '', last_name: '', email: '', whatsapp: '',
    life_stage: 'builder', country: '', industry: '',
    referral_source: '', consent: false,
  });
  const [errors, setErrors]           = useState<FormErrors>({});
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess]         = useState<SuccessData | null>(null);
  const [copied, setCopied]           = useState(false);

  /* ── Particle canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let W = 0, H = 0, raf = 0;
    interface P { x:number;y:number;r:number;dx:number;dy:number;o:number }
    let pts: P[] = [];
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const init   = () => { pts = Array.from({length:60},()=>({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.5+0.5, dx:(Math.random()-.5)*.3, dy:(Math.random()-.5)*.3, o:Math.random()*.4+.1 })); };
    const draw   = () => {
      ctx.clearRect(0,0,W,H);
      pts.forEach(p=>{ ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(232,160,32,${p.o})`;ctx.fill();p.x+=p.dx;p.y+=p.dy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0; });
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<120){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(232,160,32,${.06*(1-d/120)})`;ctx.lineWidth=.5;ctx.stroke();}}
      raf = requestAnimationFrame(draw);
    };
    resize(); init(); draw();
    window.addEventListener('resize', ()=>{resize();init();});
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Counter animation ── */
  useEffect(() => {
    const t = setTimeout(() => {
      let c = 227;
      const iv = setInterval(()=>{ c++; setCount(c); if(c>=247) clearInterval(iv); }, 60);
      return ()=>clearInterval(iv);
    }, 800);
    return ()=>clearTimeout(t);
  }, []);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(p=>({...p,[key]:val}));
    if (errors[key as keyof FormErrors]) setErrors(p=>({...p,[key]:undefined}));
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await fetch('/api/waitlist', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, email: form.email.trim().toLowerCase(), whatsapp: form.whatsapp.trim(),
          utm_source: params.get('utm_source')??undefined, utm_medium: params.get('utm_medium')??undefined,
          utm_campaign: params.get('utm_campaign')??undefined, landing_page: window.location.pathname }),
      });
      const data = await res.json();
      if (res.ok || res.status===409) setSuccess({ position: data.position??248, referral_code: data.referral_code??'' });
      else setServerError(data.error??'Something went wrong. Please try again.');
    } catch { setServerError('Network error. Please check your connection.'); }
    finally { setLoading(false); }
  }, [form]);

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/waitlist?ref=${success?.referral_code}`);
    setCopied(true); setTimeout(()=>setCopied(false), 2500);
  }

  /* ─────────────────────── STYLES ─────────────────────── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700;800&display=swap');
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{font-family:'Syne',sans-serif;background:#0C0B08;color:#F5F0E8;overflow-x:hidden;min-height:100vh}
    .grain{position:fixed;inset:0;z-index:1;opacity:.032;pointer-events:none;
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
    .page{position:relative;z-index:2;min-height:100vh;display:grid;grid-template-columns:1fr 1fr}
    .left{display:flex;flex-direction:column;justify-content:space-between;padding:52px 56px;border-right:1px solid rgba(245,240,232,.07);min-height:100vh}
    .right{display:flex;flex-direction:column;justify-content:center;padding:52px 56px;background:#141310;position:relative;overflow:hidden}
    .right::before{content:'';position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(232,160,32,.06) 0%,transparent 70%);top:-100px;right:-100px;pointer-events:none}
    .right::after{content:'';position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(232,160,32,.04) 0%,transparent 70%);bottom:-50px;left:-50px;pointer-events:none}
    .logo{display:flex;align-items:center;gap:10px;text-decoration:none}
    .logo-mark{width:36px;height:36px;background:#E8A020;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:#0C0B08}
    .logo-text{font-size:18px;font-weight:700;color:#F5F0E8;letter-spacing:-.01em}
    .left-mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px 0}
    .eyebrow{display:inline-flex;align-items:center;gap:10px;margin-bottom:32px}
    .eyebrow-line{width:32px;height:1.5px;background:#E8A020}
    .eyebrow-text{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#E8A020}
    .headline{font-family:'Cormorant Garamond',serif;font-size:clamp(48px,5.5vw,80px);font-weight:700;line-height:1;color:#F5F0E8;margin-bottom:28px}
    .headline em{font-style:italic;color:#E8A020}
    .sub{font-size:16px;line-height:1.75;color:rgba(245,240,232,.55);max-width:420px;margin-bottom:48px}
    .sub strong{color:#F5F0E8;font-weight:600}
    .proofs{display:flex;flex-direction:column;gap:16px;margin-bottom:52px}
    .proof-item{display:flex;align-items:flex-start;gap:14px}
    .proof-icon{width:32px;height:32px;border-radius:8px;background:rgba(232,160,32,.15);border:1px solid rgba(232,160,32,.25);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:1px}
    .proof-body{font-size:14px;line-height:1.6;color:rgba(245,240,232,.55)}
    .proof-body strong{color:#F5F0E8;font-weight:600;display:block;margin-bottom:2px}
    .counter{display:flex;align-items:center;gap:20px;padding:20px 24px;background:#1E1C17;border-radius:14px;border:1px solid rgba(245,240,232,.07);position:relative;overflow:hidden}
    .counter::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#E8A020,transparent)}
    .counter-avatars{display:flex}
    .avatar{width:34px;height:34px;border-radius:50%;border:2px solid #1E1C17;margin-right:-10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0C0B08;flex-shrink:0}
    .counter-text{font-size:13px;color:rgba(245,240,232,.55);line-height:1.5}
    .counter-text strong{color:#F5F0E8;font-weight:700}
    .live{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#4ade80;text-transform:uppercase;letter-spacing:.08em;flex-shrink:0}
    .live-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:pulse 2s ease infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}
    .left-bottom{padding-top:24px;border-top:1px solid rgba(245,240,232,.07);font-size:12px;color:rgba(245,240,232,.28);line-height:1.5}
    .left-bottom strong{color:#E8A020}
    .form-wrap{position:relative;z-index:1;max-width:440px;width:100%;margin:0 auto}
    .dots{display:flex;gap:8px;margin-bottom:20px}
    .dot{width:8px;height:8px;border-radius:50%;background:rgba(232,160,32,.25)}
    .dot.on{background:#E8A020;box-shadow:0 0 8px rgba(232,160,32,.5)}
    .form-title{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:700;color:#F5F0E8;line-height:1.15;margin-bottom:10px}
    .form-sub{font-size:14px;color:rgba(245,240,232,.55);margin-bottom:36px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .field{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
    .field.half{margin-bottom:0}
    .lbl{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,240,232,.55)}
    .lbl span{color:rgba(245,240,232,.28);font-weight:400;text-transform:none;letter-spacing:0}
    input,select{width:100%;background:#1E1C17;border:1.5px solid rgba(245,240,232,.07);border-radius:10px;padding:14px 16px;font-family:'Syne',sans-serif;font-size:14px;color:#F5F0E8;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}
    select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(245,240,232,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:40px;cursor:pointer}
    select option{background:#1E1C17;color:#F5F0E8}
    input::placeholder{color:rgba(245,240,232,.28)}
    input:focus,select:focus{border-color:#E8A020;box-shadow:0 0 0 3px rgba(232,160,32,.1)}
    input.err,select.err{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.1)}
    .errmsg{font-size:11px;color:#ef4444;margin-top:2px}
    .stages{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
    .stage-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;background:#1E1C17;border:1.5px solid rgba(245,240,232,.07);border-radius:10px;cursor:pointer;transition:all .2s;text-align:center}
    .stage-btn:hover{border-color:rgba(232,160,32,.25)}
    .stage-btn.on{border-color:#E8A020;background:rgba(232,160,32,.15);box-shadow:0 0 0 3px rgba(232,160,32,.1)}
    .stage-emoji{font-size:20px}
    .stage-name{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:rgba(245,240,232,.55);line-height:1.3}
    .stage-btn.on .stage-name{color:#E8A020}
    .stage-age{font-size:10px;color:rgba(245,240,232,.28)}
    .sources{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
    .src-btn{display:flex;align-items:center;gap:8px;padding:11px 14px;background:#1E1C17;border:1.5px solid rgba(245,240,232,.07);border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;color:rgba(245,240,232,.55);transition:all .2s;font-family:'Syne',sans-serif}
    .src-btn:hover{border-color:rgba(232,160,32,.25)}
    .src-btn.on{border-color:#E8A020;background:rgba(232,160,32,.15);color:#E8A020}
    .consent{display:flex;align-items:flex-start;gap:12px;margin-bottom:24px;cursor:pointer}
    .consent input[type=checkbox]{width:18px;height:18px;min-width:18px;background:#1E1C17;border:1.5px solid rgba(245,240,232,.07);border-radius:5px;cursor:pointer;accent-color:#E8A020;margin-top:1px;flex-shrink:0}
    .consent-text{font-size:12px;color:rgba(245,240,232,.28);line-height:1.6}
    .consent-text a{color:#E8A020;text-decoration:none}
    .submit{width:100%;background:#E8A020;color:#0C0B08;font-family:'Syne',sans-serif;font-size:15px;font-weight:800;letter-spacing:.02em;padding:17px 28px;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .25s;box-shadow:0 8px 32px rgba(232,160,32,.35)}
    .submit:hover:not(:disabled){background:#F5C55A;transform:translateY(-2px);box-shadow:0 12px 40px rgba(232,160,32,.45)}
    .submit:active{transform:translateY(0)}
    .submit:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none}
    .arrow{font-size:18px;transition:transform .2s}
    .submit:hover:not(:disabled) .arrow{transform:translateX(4px)}
    @keyframes spin{to{transform:rotate(360deg)}}
    .spinner{width:18px;height:18px;border:2px solid rgba(12,11,8,.3);border-top-color:#0C0B08;border-radius:50%;animation:spin .7s linear infinite}
    .trust{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:20px;padding-top:20px;border-top:1px solid rgba(245,240,232,.07)}
    .trust-item{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(245,240,232,.28)}
    .srv-err{font-size:12px;padding:12px 14px;border-radius:8px;margin-bottom:16px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#fca5a5}
    /* success */
    .success-wrap{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:440px;width:100%;margin:0 auto;animation:fadeUp .6s ease both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .suc-icon{width:80px;height:80px;background:rgba(232,160,32,.15);border:1.5px solid rgba(232,160,32,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:28px;animation:pop .5s .2s cubic-bezier(.175,.885,.32,1.275) both}
    @keyframes pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
    .suc-title{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:700;color:#F5F0E8;line-height:1.1;margin-bottom:14px}
    .suc-title em{color:#E8A020;font-style:italic}
    .suc-sub{font-size:15px;line-height:1.7;color:rgba(245,240,232,.55);margin-bottom:36px;max-width:360px}
    .pos-card{width:100%;background:#1E1C17;border:1px solid rgba(232,160,32,.25);border-radius:16px;padding:24px 28px;margin-bottom:28px;position:relative;overflow:hidden}
    .pos-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#E8A020,#F5C55A,transparent)}
    .pos-label{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(245,240,232,.28);margin-bottom:8px}
    .pos-num{font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:700;color:#E8A020;line-height:1;margin-bottom:4px}
    .pos-sub{font-size:13px;color:rgba(245,240,232,.28)}
    .share-lbl{font-size:13px;font-weight:600;color:rgba(245,240,232,.55);margin-bottom:14px;text-align:center}
    .share-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
    .share-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:10px;border:1.5px solid rgba(245,240,232,.07);background:#1E1C17;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:rgba(245,240,232,.55);cursor:pointer;text-decoration:none;transition:all .2s}
    .share-btn.wa:hover{border-color:#25D366;color:#25D366}
    .share-btn.li:hover{border-color:#0A66C2;color:#0A66C2}
    .copy-row{display:flex;border-radius:8px;overflow:hidden;border:1.5px solid rgba(245,240,232,.07)}
    .copy-url{flex:1;padding:11px 14px;font-size:12px;color:rgba(245,240,232,.28);background:#252219;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .copy-btn{padding:11px 18px;background:rgba(232,160,32,.15);border:none;border-left:1.5px solid rgba(245,240,232,.07);font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:#E8A020;cursor:pointer;white-space:nowrap;transition:all .2s}
    .copy-btn:hover,.copy-btn.copied{background:#E8A020;color:#0C0B08}
    .back{margin-top:24px;font-size:12px;color:rgba(245,240,232,.28);text-decoration:underline}
    @media(max-width:900px){
      .page{grid-template-columns:1fr}
      .left{min-height:auto;border-right:none;border-bottom:1px solid rgba(245,240,232,.07);padding:36px 28px 40px}
      .right{padding:40px 28px 60px}
      .left-mid{padding:40px 0}
      .headline{font-size:clamp(40px,8vw,56px)}
    }
  `;

  /* ── Success state ── */
  if (success) {
    const txt = encodeURIComponent("I just joined the Ascentor waitlist — Africa's mentorship platform. Early members get 3 months free. Join me 👇");
    const url = encodeURIComponent(`${typeof window!=='undefined'?window.location.origin:'https://ascentorbi.com'}/waitlist?ref=${success.referral_code}`);
    const rawUrl = `${typeof window!=='undefined'?window.location.origin:'https://ascentorbi.com'}/waitlist?ref=${success.referral_code}`;

    return (
      <>
        <style>{css}</style>
        <div className="grain" />
        <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}} />
        <div style={{position:'relative',zIndex:2,minHeight:'100vh',background:'#0C0B08',display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 24px'}}>
          <div className="success-wrap">
            <div className="suc-icon">🎉</div>
            <h2 className="suc-title">You&apos;re in,<br /><em>officially.</em></h2>
            <p className="suc-sub">Welcome to the Ascentor waitlist. Check your inbox — a confirmation is on its way. Your mentor is almost ready for you.</p>
            <div className="pos-card">
              <div className="pos-label">Your Waitlist Position</div>
              <div className="pos-num">#{success.position}</div>
              <div className="pos-sub">Early members get 3 months free · No credit card needed</div>
            </div>
            <div style={{width:'100%'}}>
              <p className="share-lbl">Move up the list — share with someone who needs this 🚀</p>
              <div className="share-btns">
                <a href={`https://wa.me/?text=${txt}%20${url}`} target="_blank" rel="noopener noreferrer" className="share-btn wa">💬 Share on WhatsApp</a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`} target="_blank" rel="noopener noreferrer" className="share-btn li">💼 Share on LinkedIn</a>
              </div>
              <div className="copy-row">
                <span className="copy-url">{rawUrl}</span>
                <button className={`copy-btn${copied?' copied':''}`} onClick={copyLink}>{copied?'✓ Copied!':'Copy Link'}</button>
              </div>
            </div>
            <Link href="/" className="back">Back to homepage</Link>
          </div>
        </div>
      </>
    );
  }

  /* ── Form state ── */
  return (
    <>
      <style>{css}</style>
      <div className="grain" />
      <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}} aria-hidden="true" />

      <div className="page">

        {/* ══ LEFT PANEL ══ */}
        <div className="left">
          <Link href="/" className="logo">
            <div className="logo-mark">A</div>
            <span className="logo-text">Ascentor</span>
          </Link>

          <div className="left-mid">
            <div className="eyebrow">
              <div className="eyebrow-line" />
              <span className="eyebrow-text">Coming Soon — Join the Waitlist</span>
            </div>

            <h1 className="headline">
              Your<br />
              <em>mentor</em><br />
              is waiting.
            </h1>

            <p className="sub">
              Africa&apos;s mentorship platform — built for{' '}
              <strong>every stage of your journey.</strong>{' '}
              From figuring out what to do with your life, to reaching the very top of your career.
            </p>

            <div className="proofs">
              {[
                { e:'🤖', t:'24/7 AI Mentor', d:'Personalized guidance trained on African career context — available at 2am before your biggest moment.' },
                { e:'🎓', t:"Human Mentors Who've Been There", d:"Live sessions with Africa's top professionals. Real experience. Not theory." },
                { e:'👥', t:'Your Mentorship Circle', d:'Matched with peers at your exact life stage. Your personal board of advisors.' },
              ].map(p => (
                <div className="proof-item" key={p.t}>
                  <div className="proof-icon">{p.e}</div>
                  <div className="proof-body"><strong>{p.t}</strong>{p.d}</div>
                </div>
              ))}
            </div>

            <div className="counter">
              <div className="counter-avatars">
                {AVATARS.map((a,i) => <div key={i} className="avatar" style={{background:a.bg}}>{a.i}</div>)}
              </div>
              <div className="counter-text">
                <strong>{count} people</strong> already on the waitlist<br />across 15 African countries
              </div>
              <div className="live">
                <div className="live-dot" />
                Live
              </div>
            </div>
          </div>

          <div className="left-bottom">
            Early members get <strong>3 months free</strong> on launch · No spam, ever · Unsubscribe anytime
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="right">
          <div className="form-wrap">

            {/* Step dots + title */}
            <div className="dots">
              <div className="dot on" /><div className="dot" /><div className="dot" />
            </div>
            <h2 className="form-title">Secure your<br />early access.</h2>
            <p className="form-sub">Takes 60 seconds. Early members get 3 months free on launch.</p>

            <form onSubmit={handleSubmit} noValidate>

              {/* Name */}
              <div className="grid2">
                <div className="field half">
                  <label className="lbl">First Name</label>
                  <input type="text" placeholder="Temi" autoComplete="given-name"
                    className={errors.first_name?'err':''} value={form.first_name}
                    onChange={e=>set('first_name',e.target.value)} />
                  {errors.first_name && <span className="errmsg">{errors.first_name}</span>}
                </div>
                <div className="field half">
                  <label className="lbl">Last Name</label>
                  <input type="text" placeholder="Adeyemi" autoComplete="family-name"
                    className={errors.last_name?'err':''} value={form.last_name}
                    onChange={e=>set('last_name',e.target.value)} />
                  {errors.last_name && <span className="errmsg">{errors.last_name}</span>}
                </div>
              </div>

              {/* Email */}
              <div className="field">
                <label className="lbl">Email Address</label>
                <input type="email" placeholder="temi@email.com" autoComplete="email"
                  className={errors.email?'err':''} value={form.email}
                  onChange={e=>set('email',e.target.value)} />
                {errors.email && <span className="errmsg">{errors.email}</span>}
              </div>

              {/* WhatsApp */}
              <div className="field">
                <label className="lbl">WhatsApp Number</label>
                <input type="tel" placeholder="+234 801 234 5678" autoComplete="tel"
                  className={errors.whatsapp?'err':''} value={form.whatsapp}
                  onChange={e=>set('whatsapp',e.target.value)} />
                {errors.whatsapp && <span className="errmsg">{errors.whatsapp}</span>}
              </div>

              {/* Life stage */}
              <div className="field" style={{gap:8}}>
                <label className="lbl">Your Life Stage</label>
                <div className="stages">
                  {STAGES.map(s => (
                    <button key={s.value} type="button"
                      className={`stage-btn${form.life_stage===s.value?' on':''}`}
                      onClick={()=>set('life_stage',s.value)}>
                      <span className="stage-emoji">{s.emoji}</span>
                      <span className="stage-name">{s.label}</span>
                      <span className="stage-age">{s.age}</span>
                    </button>
                  ))}
                </div>
                {errors.life_stage && <span className="errmsg">{errors.life_stage}</span>}
              </div>

              {/* Country + Industry */}
              <div className="grid2">
                <div className="field half">
                  <label className="lbl">Country</label>
                  <select className={errors.country?'err':''} value={form.country}
                    onChange={e=>set('country',e.target.value)}>
                    <option value="">Select country</option>
                    {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  {errors.country && <span className="errmsg">{errors.country}</span>}
                </div>
                <div className="field half">
                  <label className="lbl">Industry <span>(optional)</span></label>
                  <select value={form.industry} onChange={e=>set('industry',e.target.value)}>
                    <option value="">Your industry</option>
                    {INDUSTRIES.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Referral source */}
              <div className="field" style={{gap:8}}>
                <label className="lbl">How did you hear about us? <span>(optional)</span></label>
                <div className="sources">
                  {SOURCES.map(s => (
                    <button key={s.value} type="button"
                      className={`src-btn${form.referral_source===s.value?' on':''}`}
                      onClick={()=>set('referral_source', form.referral_source===s.value?'':s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consent */}
              <label className="consent">
                <input type="checkbox" checked={form.consent} onChange={e=>set('consent',e.target.checked)} />
                <span className="consent-text">
                  I agree to receive updates about Ascentor&apos;s launch and early access offers.
                  No spam — ever. View our <Link href="/terms">Privacy Policy</Link>.
                </span>
              </label>
              {errors.consent && <span className="errmsg" style={{display:'block',marginTop:-18,marginBottom:14}}>{errors.consent}</span>}

              {/* Server error */}
              {serverError && <div className="srv-err">{serverError}</div>}

              {/* Submit */}
              <button type="submit" className="submit" disabled={loading}>
                {loading
                  ? <><div className="spinner" />Securing your spot...</>
                  : <>Secure My Spot <span className="arrow">→</span></>}
              </button>

              {/* Trust */}
              <div className="trust">
                {[['🔒','Secure & private'],['🎁','3 months free'],['✨','No spam, ever']].map(([ic,tx])=>(
                  <div className="trust-item" key={tx}><span>{ic}</span>{tx}</div>
                ))}
              </div>

            </form>
          </div>
        </div>

      </div>
    </>
  );
}
