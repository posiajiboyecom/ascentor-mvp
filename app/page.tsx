'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [hasBlogPosts, setHasBlogPosts] = useState(false);

  // B7: Check if blog has published posts — hide nav link when empty
  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .then(({ count }) => { if ((count || 0) > 0) setHasBlogPosts(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSubLoading(true);
    setSubError('');
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: trimmed,
      is_active: true,
      source: 'landing_page',
      subscribed_at: new Date().toISOString(),
    });
    setSubLoading(false);
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        setSubError("You're already subscribed!");
      } else {
        setSubError('Something went wrong. Please try again.');
      }
    } else {
      setSubscribed(true);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --gold: #E8A020;
          --gold-light: #F5C55A;
          --gold-pale: #FDF3E0;
          --dark: #0F0E0B;
          --dark-2: #1A1914;
          --dark-3: #252420;
          --mid: #5C5947;
          --light: #F7F4EE;
          --white: #FDFCF9;
          --text: #2A2820;
          --text-light: #7A7560;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .lp-body {
          font-family: 'Syne', system-ui, sans-serif;
          background: var(--white);
          color: var(--text);
          overflow-x: hidden;
        }

        /* ── NAV ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          background: rgba(253,252,249,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(232,160,32,0.12);
        }
        .lp-nav-logo {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px; font-weight: 700;
          color: var(--dark); text-decoration: none;
        }
        .lp-nav-logo span { color: var(--gold); }
        .lp-nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
        .lp-nav-links a { text-decoration: none; color: var(--mid); font-size: 15px; font-weight: 500; transition: color 0.2s; }
        .lp-nav-links a:hover { color: var(--dark); }
        .lp-nav-cta {
          background: var(--gold) !important; color: var(--dark) !important;
          padding: 10px 22px; border-radius: 8px;
          font-weight: 600 !important; font-size: 14px !important;
          transition: background 0.2s, transform 0.15s !important;
        }
        .lp-nav-cta:hover { background: var(--gold-light) !important; transform: translateY(-1px); }

        /* ── HERO ── */
        .lp-hero {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 120px 24px 80px; position: relative; overflow: hidden;
          background: var(--white);
        }
        .lp-hero-img {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=80');
          background-size: cover;
          background-position: center 30%;
          opacity: 0.18;
          z-index: 0;
        }
        .lp-hero-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 1;
          background:
            linear-gradient(to bottom, rgba(253,252,249,0.55) 0%, rgba(253,252,249,0.1) 40%, rgba(253,252,249,0.7) 100%),
            radial-gradient(ellipse 60% 50% at 15% 80%, rgba(232,160,32,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 85% 20%, rgba(232,160,32,0.08) 0%, transparent 60%);
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--gold-pale); border: 1px solid rgba(232,160,32,0.3);
          border-radius: 100px; padding: 7px 16px;
          font-size: 13px; font-weight: 500; color: #8B6010;
          margin-bottom: 32px; animation: lp-fadeDown 0.6s ease both;
          position: relative; z-index: 1;
        }
        .lp-badge-dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--gold);
          animation: lp-pulse 2s ease infinite;
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes lp-fadeDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-hero-headline {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(44px, 7vw, 88px); font-weight: 900; line-height: 1.05;
          text-align: center; max-width: 860px; color: var(--dark);
          animation: lp-fadeUp 0.7s 0.15s ease both; position: relative; z-index: 1;
        }
        .lp-hero-headline .accent { color: var(--gold); }
        .lp-hero-sub {
          max-width: 560px; text-align: center; font-size: 18px; line-height: 1.7;
          color: var(--text-light); margin-top: 24px; font-weight: 400;
          animation: lp-fadeUp 0.7s 0.3s ease both; position: relative; z-index: 1;
        }
        .lp-hero-sub strong { color: var(--text); font-weight: 600; }
        .lp-hero-actions {
          display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
          margin-top: 40px; animation: lp-fadeUp 0.7s 0.45s ease both;
          position: relative; z-index: 1;
        }
        .lp-btn-primary {
          background: var(--gold); color: var(--dark);
          font-family: 'Syne', system-ui, sans-serif; font-size: 16px; font-weight: 700;
          padding: 16px 32px; border-radius: 10px; border: none; cursor: pointer;
          text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s; box-shadow: 0 4px 20px rgba(232,160,32,0.35);
        }
        .lp-btn-primary:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 8px 28px rgba(232,160,32,0.45); }
        .lp-btn-secondary {
          background: transparent; color: var(--text);
          font-family: 'Syne', system-ui, sans-serif; font-size: 15px; font-weight: 500;
          padding: 15px 28px; border-radius: 10px;
          border: 1.5px solid rgba(42,40,32,0.15); cursor: pointer; text-decoration: none; transition: all 0.2s;
        }
        .lp-btn-secondary:hover { border-color: var(--gold); color: var(--gold); }
        .lp-hero-trust {
          margin-top: 16px; font-size: 13px; color: var(--text-light);
          animation: lp-fadeUp 0.7s 0.55s ease both; position: relative; z-index: 1;
        }

        /* ── STATS BAR ── */
        .lp-stats-bar { background: var(--dark); padding: 40px 48px; display: flex; justify-content: center; }
        .lp-stat-item { text-align: center; padding: 0 60px; border-right: 1px solid rgba(255,255,255,0.08); }
        .lp-stat-item:last-child { border-right: none; }
        .lp-stat-number { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 44px; font-weight: 700; color: var(--gold); line-height: 1; }
        .lp-stat-label { font-size: 14px; color: rgba(255,255,255,0.5); margin-top: 8px; }

        /* ── SHARED ── */
        .lp-section-label { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); margin-bottom: 16px; }
        .lp-section-headline { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(32px, 4vw, 52px); font-weight: 700; text-align: center; color: var(--dark); max-width: 680px; line-height: 1.15; }
        .lp-section-sub { text-align: center; font-size: 17px; line-height: 1.6; color: var(--text-light); max-width: 540px; margin-top: 16px; }

        /* ── PROBLEM ── */
        .lp-problem-section { padding: 100px 48px; background: var(--light); display: flex; flex-direction: column; align-items: center; }
        .lp-problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1000px; margin-top: 60px; }
        .lp-problem-card { background: var(--white); border-radius: 16px; padding: 36px 32px; border: 1px solid rgba(42,40,32,0.06); position: relative; overflow: hidden; }
        .lp-problem-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--gold), transparent); }
        .lp-problem-quote { font-size: 15px; line-height: 1.7; color: var(--text); font-style: italic; margin-bottom: 20px; }
        .lp-problem-quote strong { color: var(--dark); font-style: normal; font-weight: 600; }
        .lp-problem-persona { font-size: 13px; color: var(--text-light); font-weight: 500; }

        /* ── FOR SECTION ── */
        .lp-for-section { padding: 100px 48px; background: var(--white); display: flex; flex-direction: column; align-items: center; }
        .lp-for-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1040px; margin-top: 56px; width: 100%; }
        .lp-for-card { border-radius: 20px; padding: 40px 32px; position: relative; overflow: hidden; transition: transform 0.25s, box-shadow 0.25s; cursor: default; }
        .lp-for-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
        .lp-for-card.explorer { background: #F7F2E8; border: 1.5px solid rgba(232,160,32,0.2); }
        .lp-for-card.builder { background: var(--dark-2); border: 1.5px solid rgba(232,160,32,0.15); }
        .lp-for-card.climber { background: var(--gold); border: 1.5px solid transparent; }
        .lp-for-tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; margin-bottom: 20px; }
        .explorer .lp-for-tag { background: rgba(232,160,32,0.15); color: #8B6010; }
        .builder .lp-for-tag { background: rgba(232,160,32,0.15); color: var(--gold); }
        .climber .lp-for-tag { background: rgba(15,14,11,0.12); color: var(--dark); }
        .lp-for-age { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 900; line-height: 1; margin-bottom: 8px; }
        .explorer .lp-for-age { color: var(--dark); }
        .builder .lp-for-age { color: var(--white); }
        .climber .lp-for-age { color: var(--dark); }
        .lp-for-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
        .explorer .lp-for-title { color: var(--dark); }
        .builder .lp-for-title { color: var(--white); }
        .climber .lp-for-title { color: var(--dark); }
        .lp-for-desc { font-size: 14px; line-height: 1.7; font-weight: 400; }
        .explorer .lp-for-desc { color: var(--text-light); }
        .builder .lp-for-desc { color: rgba(255,255,255,0.6); }
        .climber .lp-for-desc { color: rgba(15,14,11,0.7); }
        .lp-for-list { list-style: none; margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
        .lp-for-list li { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
        .explorer .lp-for-list li { color: var(--text); }
        .builder .lp-for-list li { color: rgba(255,255,255,0.75); }
        .climber .lp-for-list li { color: var(--dark); }
        .lp-for-list li::before { content: '→'; font-size: 12px; opacity: 0.6; }

        /* ── PILLARS ── */
        .lp-pillars-section { padding: 100px 48px; background: var(--dark); display: flex; flex-direction: column; align-items: center; }
        .lp-pillars-section .lp-section-headline { color: var(--white); }
        .lp-pillars-section .lp-section-sub { color: rgba(255,255,255,0.5); }
        .lp-pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1040px; margin-top: 56px; width: 100%; }
        .lp-pillar-card { background: var(--dark-2); border-radius: 20px; padding: 40px 32px; border: 1px solid rgba(255,255,255,0.06); position: relative; overflow: hidden; transition: border-color 0.25s, transform 0.25s; }
        .lp-pillar-card:hover { border-color: rgba(232,160,32,0.3); transform: translateY(-3px); }
        .lp-pillar-icon { width: 52px; height: 52px; background: rgba(232,160,32,0.12); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 24px; }
        .lp-pillar-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 700; color: var(--white); margin-bottom: 12px; }
        .lp-pillar-desc { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.5); margin-bottom: 24px; }
        .lp-pillar-features { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .lp-pillar-features li { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.7); display: flex; align-items: flex-start; gap: 10px; }
        .lp-pillar-features li::before { content: '✓'; color: var(--gold); font-size: 13px; flex-shrink: 0; margin-top: 1px; }

        /* ── HOW IT WORKS ── */
        .lp-how-section { padding: 100px 48px; background: var(--light); display: flex; flex-direction: column; align-items: center; }
        .lp-steps-container { display: flex; align-items: flex-start; max-width: 900px; margin-top: 60px; width: 100%; position: relative; }
        .lp-steps-container::before { content: ''; position: absolute; top: 32px; left: calc(33.33% / 2); right: calc(33.33% / 2); height: 1.5px; background: linear-gradient(90deg, var(--gold), rgba(232,160,32,0.2), var(--gold)); }
        .lp-step { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 24px; }
        .lp-step-number { width: 64px; height: 64px; background: var(--white); border: 2px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 700; color: var(--gold); margin-bottom: 24px; position: relative; z-index: 1; box-shadow: 0 0 0 6px var(--light); }
        .lp-step-title { font-size: 17px; font-weight: 700; color: var(--dark); margin-bottom: 10px; }
        .lp-step-desc { font-size: 14px; line-height: 1.7; color: var(--text-light); }

        /* ── TESTIMONIALS ── */
        .lp-testimonials-section { padding: 100px 48px; background: var(--white); display: flex; flex-direction: column; align-items: center; }
        .lp-testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1040px; margin-top: 56px; width: 100%; }
        .lp-testimonial-card { background: var(--light); border-radius: 20px; padding: 36px; border: 1px solid rgba(42,40,32,0.06); display: flex; flex-direction: column; transition: transform 0.25s, box-shadow 0.25s; }
        .lp-testimonial-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.07); }
        .lp-testimonial-card.featured { background: var(--dark); border-color: rgba(232,160,32,0.2); }
        .lp-testimonial-stars { display: flex; gap: 3px; margin-bottom: 20px; }
        .lp-star { color: var(--gold); font-size: 16px; }
        .lp-testimonial-quote { font-size: 15px; line-height: 1.75; color: var(--text); flex: 1; margin-bottom: 24px; }
        .featured .lp-testimonial-quote { color: rgba(255,255,255,0.85); }
        .lp-testimonial-author { display: flex; align-items: center; gap: 12px; }
        .lp-author-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--gold-light)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: var(--dark); flex-shrink: 0; }
        .lp-author-name { font-size: 14px; font-weight: 700; color: var(--dark); }
        .featured .lp-author-name { color: var(--white); }
        .lp-author-role { font-size: 12px; color: var(--text-light); margin-top: 2px; }
        .featured .lp-author-role { color: rgba(255,255,255,0.45); }

        /* ── MENTORS ── */
        .lp-mentors-section { padding: 100px 48px; background: var(--gold-pale); display: flex; flex-direction: column; align-items: center; }
        .lp-mentors-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 900px; margin-top: 56px; width: 100%; }
        .lp-mentor-card { background: var(--white); border-radius: 20px; padding: 32px; border: 1px solid rgba(232,160,32,0.12); text-align: center; transition: transform 0.25s, box-shadow 0.25s; }
        .lp-mentor-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(232,160,32,0.12); }
        .lp-mentor-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), #C87020); display: flex; align-items: center; justify-content: center; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 700; color: var(--white); margin: 0 auto 16px; border: 3px solid rgba(232,160,32,0.2); }
        .lp-mentor-name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; font-weight: 700; color: var(--dark); margin-bottom: 4px; }
        .lp-mentor-title { font-size: 13px; color: var(--text-light); margin-bottom: 16px; line-height: 1.5; }
        .lp-mentor-badge { display: inline-block; background: rgba(232,160,32,0.12); color: #8B6010; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; }

        /* ── PRICING ── */
        .lp-pricing-section { padding: 100px 48px; background: var(--dark); display: flex; flex-direction: column; align-items: center; }
        .lp-pricing-section .lp-section-headline { color: var(--white); }
        .lp-pricing-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 900px; margin-top: 56px; width: 100%; }
        .lp-pricing-card { background: var(--dark-2); border-radius: 20px; padding: 36px 28px; border: 1px solid rgba(255,255,255,0.06); transition: border-color 0.25s, transform 0.25s; position: relative; }
        .lp-pricing-card:hover { border-color: rgba(232,160,32,0.25); transform: translateY(-3px); }
        .lp-pricing-card.popular { border-color: var(--gold); background: var(--dark-3); }
        .lp-popular-tag { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--gold); color: var(--dark); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 14px; border-radius: 100px; white-space: nowrap; }
        .lp-pricing-plan { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); margin-bottom: 16px; }
        .lp-pricing-price { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 48px; font-weight: 700; color: var(--white); line-height: 1; }
        .lp-pricing-price span { font-size: 18px; font-weight: 400; color: rgba(255,255,255,0.4); font-family: 'Syne', system-ui, sans-serif; }
        .lp-pricing-for { font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 6px; margin-bottom: 28px; }
        .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
        .lp-pricing-features li { font-size: 13px; color: rgba(255,255,255,0.65); display: flex; align-items: flex-start; gap: 10px; line-height: 1.5; }
        .lp-pricing-features li::before { content: '✓'; color: var(--gold); font-size: 12px; flex-shrink: 0; margin-top: 2px; }
        .lp-pricing-btn { display: block; text-align: center; text-decoration: none; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 700; transition: all 0.2s; }
        .lp-pricing-btn.outline { border: 1.5px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
        .lp-pricing-btn.outline:hover { border-color: var(--gold); color: var(--gold); }
        .lp-pricing-btn.filled { background: var(--gold); color: var(--dark); border: none; box-shadow: 0 4px 20px rgba(232,160,32,0.3); }
        .lp-pricing-btn.filled:hover { background: var(--gold-light); transform: translateY(-1px); }

        /* ── CTA ── */
        .lp-cta-section { padding: 120px 48px; background: var(--white); display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden; }
        .lp-cta-section::before { content: ''; position: absolute; width: 800px; height: 800px; border-radius: 50%; background: radial-gradient(circle, rgba(232,160,32,0.07) 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .lp-cta-headline { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(38px, 5vw, 64px); font-weight: 900; color: var(--dark); max-width: 680px; line-height: 1.1; position: relative; z-index: 1; }
        .lp-cta-headline .accent { color: var(--gold); }
        .lp-cta-sub { font-size: 17px; line-height: 1.7; color: var(--text-light); max-width: 480px; margin-top: 20px; position: relative; z-index: 1; }
        .lp-cta-actions { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 40px; position: relative; z-index: 1; }
        .lp-cta-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
        .lp-btn-whatsapp { background: #25D366; color: white; font-family: 'Syne', system-ui, sans-serif; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px; border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .lp-btn-whatsapp:hover { background: #1fba59; transform: translateY(-2px); }
        .lp-email-form { display: flex; max-width: 420px; width: 100%; margin-top: 8px; border-radius: 10px; overflow: hidden; border: 1.5px solid rgba(42,40,32,0.12); }
        .lp-email-form input { flex: 1; padding: 14px 18px; font-family: 'Syne', system-ui, sans-serif; font-size: 14px; color: var(--text); border: none; outline: none; background: var(--white); }
        .lp-email-form button { background: var(--gold); color: var(--dark); border: none; padding: 14px 22px; font-family: 'Syne', system-ui, sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
        .lp-email-form button:hover { background: var(--gold-light); }
        .lp-cta-note { font-size: 12px; color: var(--text-light); margin-top: 12px; position: relative; z-index: 1; }

        /* ── FOOTER ── */
        .lp-footer { background: var(--dark-2); padding: 60px 48px 32px; }
        .lp-footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 48px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .lp-footer-brand { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 700; color: var(--white); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .lp-footer-brand span { color: var(--gold); }
        .lp-footer-tagline { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.4); max-width: 260px; }
        .lp-footer-col-title { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 20px; }
        .lp-footer-links { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .lp-footer-links a { text-decoration: none; font-size: 14px; color: rgba(255,255,255,0.4); transition: color 0.2s; }
        .lp-footer-links a:hover { color: var(--gold); }
        .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 28px; font-size: 13px; color: rgba(255,255,255,0.3); }

        /* ── HAMBURGER BUTTON ── */
        .lp-hamburger {
          display: none;
          align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 8px;
          background: rgba(232,160,32,0.08);
          border: 1.5px solid rgba(232,160,32,0.35);
          cursor: pointer; flex-direction: column; gap: 5px; padding: 10px;
          transition: all 0.2s;
        }
        .lp-hamburger:hover,
        .lp-hamburger.open { background: rgba(232,160,32,0.15); border-color: var(--gold); }
        .lp-hamburger span {
          display: block; width: 18px; height: 1.5px;
          background: var(--gold); border-radius: 2px; transition: all 0.25s;
        }
        .lp-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
        .lp-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .lp-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

        /* ── MOBILE DRAWER ── */
        .lp-mobile-drawer {
          display: none; position: fixed; inset: 0; z-index: 300;
        }
        .lp-mobile-drawer.open { display: block; }
        .lp-drawer-overlay {
          position: absolute; inset: 0; background: rgba(15,14,11,0.55);
          backdrop-filter: blur(4px);
        }
        .lp-drawer-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: min(300px, 88vw);
          background: var(--white); padding: 20px 16px;
          display: flex; flex-direction: column; gap: 4px;
          box-shadow: -20px 0 60px rgba(0,0,0,0.25);
          animation: lp-slideIn 0.22s ease;
          overflow-y: auto;
        }
        @keyframes lp-slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .lp-drawer-close {
          align-self: flex-end; background: none; border: none;
          font-size: 20px; cursor: pointer; color: var(--mid);
          padding: 4px 8px; margin-bottom: 12px;
        }
        .lp-drawer-link {
          display: block; padding: 13px 12px; border-radius: 8px;
          text-decoration: none; font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 500; color: var(--text);
          transition: background 0.15s, color 0.15s;
        }
        .lp-drawer-link:hover { background: var(--gold-pale); color: var(--dark); }
        .lp-drawer-divider { height: 1px; background: rgba(42,40,32,0.08); margin: 8px 0; }
        .lp-drawer-cta {
          display: block; margin-top: 8px; text-align: center;
          background: var(--gold); color: var(--dark) !important;
          padding: 14px; border-radius: 10px;
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
          text-decoration: none; transition: background 0.2s;
        }
        .lp-drawer-cta:hover { background: var(--gold-light); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .lp-nav { padding: 14px 20px; }
          .lp-nav-links { display: none; }
          .lp-hamburger { display: flex; }
          .lp-stats-bar { flex-direction: column; gap: 32px; padding: 48px 24px; }
          .lp-stat-item { border-right: none; padding: 0; }
          .lp-problem-grid, .lp-for-grid, .lp-pillars-grid,
          .lp-testimonials-grid, .lp-mentors-grid, .lp-pricing-cards { grid-template-columns: 1fr; }
          .lp-steps-container { flex-direction: column; gap: 40px; }
          .lp-steps-container::before { display: none; }
          .lp-footer-top { grid-template-columns: 1fr 1fr; }
          .lp-problem-section, .lp-for-section, .lp-pillars-section, .lp-how-section,
          .lp-testimonials-section, .lp-mentors-section, .lp-pricing-section,
          .lp-cta-section { padding: 72px 24px; }
          .lp-footer { padding: 48px 24px 24px; }
          .lp-founding-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="lp-body">

        {/* NAV */}
        <nav className="lp-nav">
          <Link href="/" className="lp-nav-logo">
            <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: '32px', width: 'auto' }} />
          </Link>

          {/* Desktop links */}
          <ul className="lp-nav-links">
            <li><Link href="/who-its-for">Who It's For</Link></li>
            <li><Link href="#pillars">How It Works</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
            {hasBlogPosts && <li><Link href="/blog" style={{ color: 'var(--text)' }}>Blog</Link></li>}
            <li><Link href="/login" style={{ color: 'var(--text)' }}>Log In</Link></li>
            <li><Link href="/signup" className="lp-nav-cta">Start Free →</Link></li>
          </ul>

          {/* Hamburger (mobile) */}
          <button
            className={`lp-hamburger ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </nav>

        {/* Mobile Drawer */}
        <div className={`lp-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="lp-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="lp-drawer-panel">
            <button className="lp-drawer-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
            <Link href="/who-its-for" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>Who It's For</Link>
            <Link href="#pillars" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link href="/pricing" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            {hasBlogPosts && <Link href="/blog" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>Blog</Link>}
            <div className="lp-drawer-divider" />
            <Link href="/login" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
            <Link href="/signup" className="lp-drawer-cta" onClick={() => setMobileMenuOpen(false)}>Start Free — 7 Days →</Link>
          </div>
        </div>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-hero-img" />
          <div className="lp-hero-bg" />
          <div className="lp-badge">
            <div className="lp-badge-dot" />
            Now accepting founding members — limited spots
          </div>
          <h1 className="lp-hero-headline">
            Everyone who <span className="accent">made it</span><br />
            had someone who believed in them.
          </h1>
          <p className="lp-hero-sub">
            Ascentor is Africa's mentorship platform — for <strong>every stage of your journey.</strong>{' '}
            From figuring out your path to reaching the top of your career. AI-powered. Human-led. Built for you.
          </p>
          <div className="lp-hero-actions">
            <Link href="/signup" className="lp-btn-primary">Start Free — 7 Days →</Link>
            <a href="#for-section" className="lp-btn-secondary">See if it's for you</a>
          </div>
          <p className="lp-hero-trust">No credit card required · Cancel anytime · 30-day money-back guarantee</p>
        </section>

        {/* VALUE PROPS BAR */}
        <div className="lp-stats-bar">
          {[
            { number: '24/7', label: 'Sage — always available' },
            { number: '$19', label: 'vs $200/hr executive coaching' },
            { number: '90', label: 'Day structured goal system' },
            { number: '5×', label: 'Weekly mentor-led sessions' },
          ].map((s) => (
            <div key={s.number} className="lp-stat-item">
              <div className="lp-stat-number">{s.number}</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* PROBLEM */}
        <section className="lp-problem-section">
          <div className="lp-section-label">The Problem We're Solving</div>
          <h2 className="lp-section-headline">Talent is everywhere in Africa. Guidance isn't.</h2>
          <div className="lp-problem-grid">
            {[
              { quote: '"I have a degree, I have the drive — but I genuinely don\'t know what to do next. Nobody in my family has been where I\'m trying to go."', persona: '— Temi, 24. NYSC graduate, Lagos' },
              { quote: '"I\'ve been a manager for two years but I\'m still figuring it out alone. Executive mentorship costs more than my rent."', persona: '— Kwame, 31. Team Lead, Accra' },
              { quote: '"The people who get ahead in this country aren\'t necessarily the most talented — they\'re the ones with the right connections and the right mentors."', persona: '— Amina, 28. Consultant, Nairobi' },
            ].map((c, i) => (
              <div key={i} className="lp-problem-card">
                <p className="lp-problem-quote"><strong>{c.quote}</strong></p>
                <div className="lp-problem-persona">{c.persona}</div>
              </div>
            ))}
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="lp-for-section" id="for-section">
          <div className="lp-section-label">Who Ascentor Is For</div>
          <h2 className="lp-section-headline">One platform. Every stage of your journey.</h2>
          <div className="lp-for-grid">
            <div className="lp-for-card explorer">
              <span className="lp-for-tag">The Explorer</span>
              <div className="lp-for-age">15–22</div>
              <div className="lp-for-title">Figuring it out</div>
              <p className="lp-for-desc">Students and fresh graduates navigating the gap between school and a fulfilling career.</p>
              <ul className="lp-for-list">
                <li>AI-powered career discovery</li>
                <li>Scholarship & opportunity board</li>
                <li>Mentors who started where you are</li>
                <li>Peer community of other young Africans</li>
              </ul>
            </div>
            <div className="lp-for-card builder">
              <span className="lp-for-tag">The Builder</span>
              <div className="lp-for-age">22–32</div>
              <div className="lp-for-title" style={{ color: 'var(--white)' }}>Building momentum</div>
              <p className="lp-for-desc">Early-career professionals and young entrepreneurs making their first real moves.</p>
              <ul className="lp-for-list">
                <li>Career strategy & positioning</li>
                <li>Access to industry mentors</li>
                <li>Entrepreneur mentorship tracks</li>
                <li>Live mentor masterclasses</li>
              </ul>
            </div>
            <div className="lp-for-card climber">
              <span className="lp-for-tag">The Climber</span>
              <div className="lp-for-age">32–50</div>
              <div className="lp-for-title">Going to the top</div>
              <p className="lp-for-desc">Mid-career leaders, managers, and founders who are serious about reaching the summit.</p>
              <ul className="lp-for-list">
                <li>Executive-level mentorship</li>
                <li>Leadership & management mentorship</li>
                <li>Peer mentorship circles</li>
                <li>Business strategy sessions</li>
              </ul>
            </div>
          </div>
        </section>

        {/* THREE PILLARS */}
        <section className="lp-pillars-section" id="pillars">
          <div className="lp-section-label" style={{ color: 'rgba(232,160,32,0.7)' }}>How It Works</div>
          <h2 className="lp-section-headline">Three pillars. One powerful platform.</h2>
          <p className="lp-section-sub">Everything you need to grow — AI, human mentors, and a community that holds you accountable.</p>
          <div className="lp-pillars-grid">
            <div className="lp-pillar-card">
              <div className="lp-pillar-icon">🤖</div>
              <div className="lp-pillar-title">Sage</div>
              <p className="lp-pillar-desc">Your personal mentor, available at 2am before your big presentation. Trained on African business context, career frameworks, and life navigation.</p>
              <ul className="lp-pillar-features">
                <li>Personalized to your stage and goals</li>
                <li>Remembers your conversations</li>
                <li>Action plans after every session</li>
                <li>Career, life, and business guidance</li>
                <li>24/7 — never unavailable</li>
              </ul>
            </div>
            <div className="lp-pillar-card" style={{ borderColor: 'rgba(232,160,32,0.2)' }}>
              <div className="lp-pillar-icon">🎓</div>
              <div className="lp-pillar-title">Human Mentors & Live Sessions</div>
              <p className="lp-pillar-desc">Live sessions with Africa's top professionals who've navigated the exact challenges you're facing. Real experience, not theory.</p>
              <ul className="lp-pillar-features">
                <li>Monthly live mentor sessions</li>
                <li>1-on-1 mentor booking</li>
                <li>Q&A with industry leaders</li>
                <li>Mentors across every industry</li>
                <li>Session recordings to revisit</li>
              </ul>
            </div>
            <div className="lp-pillar-card">
              <div className="lp-pillar-icon">👥</div>
              <div className="lp-pillar-title">Mentorship Circles</div>
              <p className="lp-pillar-desc">Matched with peers at your exact career stage and industry. Your personal board of advisors who get it — because they're living it too.</p>
              <ul className="lp-pillar-features">
                <li>Matched by industry & life stage</li>
                <li>Weekly accountability check-ins</li>
                <li>Private group discussions</li>
                <li>Win sharing & honest feedback</li>
                <li>Connections that last beyond the app</li>
              </ul>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="lp-how-section">
          <div className="lp-section-label">Getting Started</div>
          <h2 className="lp-section-headline">From sign-up to growth in 3 steps</h2>
          <div className="lp-steps-container">
            {[
              { n: '01', title: 'Tell us where you are', desc: 'Share your life stage, goals, industry, and biggest challenge. Takes 3 minutes. No fluff.' },
              { n: '02', title: 'Meet Sage', desc: 'Within 60 seconds, Sage gives you a personalized action plan and matches you to human mentors and circle.' },
              { n: '03', title: 'Grow with your circle', desc: 'Join peers on the same journey. Share wins, get real feedback, and hold each other accountable every week.' },
            ].map((s) => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-number">{s.n}</div>
                <div className="lp-step-title">{s.title}</div>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SOCIAL PROOF — honest founding member section */}
        <section className="lp-testimonials-section">
          <div className="lp-section-label">Be First</div>
          <h2 className="lp-section-headline">Founding members shape the platform</h2>
          <p className="lp-section-sub" style={{ marginTop: '16px', color: 'var(--text-light)', textAlign: 'center', maxWidth: '520px' }}>
            We're building Ascentor with our founding members — not just for them. Early members get locked-in pricing, direct access to the founding team, and the chance to shape what gets built next.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '900px', width: '100%', marginTop: '48px' }}
  className="lp-founding-grid">
            {[
              { icon: '🔒', title: 'Locked-in pricing', desc: 'Your founding rate is yours for life — never increases as the platform grows.' },
              { icon: '🎙️', title: 'Shape the roadmap', desc: 'Direct line to the founding team. Your feedback ships in weeks, not quarters.' },
              { icon: '🌍', title: 'Founding community', desc: 'The first circle of African professionals building careers with intention.' },
            ].map((card) => (
              <div key={card.title} style={{ background: 'var(--light)', borderRadius: '20px', padding: '32px 28px', border: '1px solid rgba(42,40,32,0.06)' }}>
                <div style={{ fontSize: '28px', marginBottom: '14px' }}>{card.icon}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '20px', fontWeight: 700, color: 'var(--dark)', marginBottom: '10px' }}>{card.title}</div>
                <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-light)' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* MENTOR SPOTLIGHT */}
        <section className="lp-mentors-section">
          <div className="lp-section-label">Founding Mentors</div>
          <h2 className="lp-section-headline">Learn from people who've been there</h2>
          <p className="lp-section-sub" style={{ color: 'var(--text-light)' }}>
            Our founding mentors are experienced professionals who've navigated Africa's professional landscape — and are investing their time to help you do the same.
          </p>
          <div className="lp-mentors-grid">
            {[
              { initials: 'TA', name: 'Tunde Adeyemi', title: 'VP Engineering · 12 years in fintech & telecoms across Nigeria and UK' },
              { initials: 'CN', name: 'Chioma Nwosu', title: 'Strategy Director · Former McKinsey · Now building her own firm in Lagos' },
              { initials: 'EO', name: 'Emmanuel Osei', title: 'Startup Founder · 3 exits · Active angel investor across West Africa' },
            ].map((m) => (
              <div key={m.initials} className="lp-mentor-card">
                <div className="lp-mentor-avatar">{m.initials}</div>
                <div className="lp-mentor-name">{m.name}</div>
                <div className="lp-mentor-title">{m.title}</div>
                <span className="lp-mentor-badge">Founding Mentor</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '40px', fontSize: '14px', color: 'var(--text-light)', textAlign: 'center' }}>
            Are you an experienced professional?{' '}
            <Link href="/mentor-apply" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Apply to become a Founding Mentor →</Link>
          </p>
        </section>

        {/* PRICING */}
        <section className="lp-pricing-section" id="pricing">
          <div className="lp-section-label" style={{ color: 'rgba(232,160,32,0.7)' }}>Simple Pricing</div>
          <h2 className="lp-section-headline">World-class mentorship at African prices</h2>
          <div className="lp-pricing-cards">
            <div className="lp-pricing-card">
              <div className="lp-pricing-plan">Explorer</div>
              <div className="lp-pricing-price">$5<span>/mo</span></div>
              <div className="lp-pricing-for">For students & graduates (15–22)</div>
              <ul className="lp-pricing-features">
                <li>Sage — career discovery mode</li>
                <li>Opportunity & scholarship board</li>
                <li>Peer community access</li>
                <li>Basic learning library</li>
                <li>Monthly group mentor session</li>
              </ul>
              <Link href="/pricing" className="lp-pricing-btn outline">Start Free Trial</Link>
            </div>
            <div className="lp-pricing-card popular">
              <div className="lp-popular-tag">Most Popular</div>
              <div className="lp-pricing-plan">Builder</div>
              <div className="lp-pricing-price">$19<span>/mo</span></div>
              <div className="lp-pricing-for">For early-career professionals (22–32)</div>
              <ul className="lp-pricing-features">
                <li>Unlimited Sage sessions</li>
                <li>Live mentor masterclasses</li>
                <li>All mentorship circles</li>
                <li>1-on-1 mentor booking (2/month)</li>
                <li>Full mentorship resource library</li>
                <li>Session summaries & goal tracking</li>
              </ul>
              <Link href="/pricing" className="lp-pricing-btn filled">Start Free Trial</Link>
            </div>
            <div className="lp-pricing-card">
              <div className="lp-pricing-plan">Climber</div>
              <div className="lp-pricing-price">$39<span>/mo</span></div>
              <div className="lp-pricing-for">For mid-career leaders (32–50)</div>
              <ul className="lp-pricing-features">
                <li>Everything in Builder</li>
                <li>Priority Sage responses</li>
                <li>Unlimited 1-on-1 mentor sessions</li>
                <li>Private executive circle</li>
                <li>Live Q&A priority access</li>
                <li>1-on-1 onboarding call</li>
              </ul>
              <Link href="/pricing" className="lp-pricing-btn outline">Start Free Trial</Link>
            </div>
          </div>
          <p style={{ marginTop: '32px', fontSize: '14px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            Looking for team or corporate plans?{' '}
            <Link href="https://zbooking.us/kA4x3" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Talk to us →</Link>
          </p>
        </section>

        {/* CTA */}
        <section className="lp-cta-section">
          <h2 className="lp-cta-headline">
            Your mentor is <span className="accent">waiting.</span><br />
            Your next level is waiting.
          </h2>
          <p className="lp-cta-sub">
            Join thousands of ambitious Africans who stopped waiting for permission and started building the career and life they deserve.
          </p>
          <div className="lp-cta-actions">
            <div className="lp-cta-buttons">
              <Link href="/signup" className="lp-btn-primary" style={{ fontSize: '17px', padding: '18px 36px' }}>
                Start Free — 7 Days →
              </Link>
              <a href="https://wa.me/234XXXXXXXXXX" className="lp-btn-whatsapp" target="_blank" rel="noreferrer">
                💬 Join WhatsApp Community
              </a>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '8px' }}>Or get weekly mentorship insights — free</p>
            {subscribed ? (
              <p style={{ fontSize: '14px', color: 'var(--gold)', fontWeight: 600 }}>✓ You're in! Check your inbox.</p>
            ) : (
              <>
                <form className="lp-email-form" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setSubError(''); }}
                    required
                  />
                  <button type="submit" disabled={subLoading}>
                    {subLoading ? 'Joining...' : 'Subscribe'}
                  </button>
                </form>
                {subError && <p style={{ fontSize: '12px', color: '#E85020', marginTop: '6px' }}>{subError}</p>}
              </>
            )}
            <p className="lp-cta-note">No credit card · Cancel anytime · 30-day money-back guarantee</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-top">
            <div>
              <img
                  src="/ascentor-light-landscape.svg"
                  alt="Ascentor"
                  style={{ height: '28px', width: 'auto', marginBottom: '12px' }}
                />
              <p className="lp-footer-tagline">Africa's mentorship platform — from figuring it out to making it happen.</p>
            </div>
            <div>
              <div className="lp-footer-col-title">Platform</div>
              <ul className="lp-footer-links">
                <li><Link href="/pricing">Pricing</Link></li>
                {hasBlogPosts && <li><Link href="/blog">Blog</Link></li>}
                <li><Link href="/teams">For Teams</Link></li>
                <li><Link href="/mentor-apply">Become a Mentor</Link></li>
                <li><Link href="/signup">Start Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <div className="lp-footer-col-title">Company</div>
              <ul className="lp-footer-links">
                <li><Link href="/about">About</Link></li>
                <li><Link href="/terms">Terms & Conditions</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/newsletter">Newsletter</Link></li>
              </ul>
            </div>
            <div>
              <div className="lp-footer-col-title">Connect</div>
              <ul className="lp-footer-links">
                <li><a href="mailto:hello@ascentorbi.com">hello@ascentor.co</a></li>
                <li><a href="https://x.com/ascentorglobal" target="_blank" rel="noreferrer">Twitter / X</a></li>
                <li><a href="https://linkedin.com/company/ascentorglobal" target="_blank" rel="noreferrer">LinkedIn</a></li>
                <li><a href="https://instagram.com/ascentor" target="_blank" rel="noreferrer">Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Ascentor. All rights reserved.</span>
            <span>Built with ❤️ for Africa</span>
          </div>
        </footer>

      </div>
    </>
  );
}
