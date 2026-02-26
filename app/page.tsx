'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
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
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

        :root {
          /* ── Ascentor Brand Colors ── */
          --brand:        #6662FF;   /* Very Light Blue (primary) */
          --brand-light:  #A6A2FF;   /* Maximum Blue Purple (secondary) */
          --brand-pale:   #EEEEFF;   /* Tint for backgrounds */
          --green-yellow: #CFFF5E;   /* Maximum Green Yellow (accent pop) */
          --fuchsia:      #FD81FD;   /* Fuchsia Pink (accent pop) */

          --dark:         #1E1E1E;   /* Eerie Black */
          --dark-2:       #252525;
          --dark-3:       #2E2E2E;
          --white:        #FFFFFF;
          --off-white:    #F5F5FF;
          --text:         #1E1E1E;
          --text-muted:   #5A5A7A;
          --border:       rgba(102,98,255,0.15);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .lp-body {
          font-family: 'Inter', sans-serif;
          background: var(--white);
          color: var(--text);
          overflow-x: hidden;
        }

        /* ── NAV ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          background: rgba(255,255,255,0.94);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--border);
        }
        .lp-nav-logo {
          display: flex; align-items: center; gap: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          color: var(--dark); text-decoration: none;
          letter-spacing: -0.02em;
        }
        .lp-nav-logo-icon {
          width: 32px; height: 32px;
          background: var(--brand);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 900; color: white;
          font-style: italic;
        }
        .lp-nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
        .lp-nav-links a { text-decoration: none; color: var(--text-muted); font-size: 15px; font-weight: 500; transition: color 0.2s; }
        .lp-nav-links a:hover { color: var(--brand); }
        .lp-nav-cta {
          background: var(--brand) !important;
          color: var(--white) !important;
          padding: 10px 22px; border-radius: 8px;
          font-weight: 600 !important; font-size: 14px !important;
          transition: background 0.2s, transform 0.15s !important;
        }
        .lp-nav-cta:hover { background: #5552EE !important; transform: translateY(-1px); color: var(--white) !important; }

        /* ── HERO ── */
        .lp-hero {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 120px 24px 80px; position: relative; overflow: hidden;
          background: var(--dark);
        }
        .lp-hero-img {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=80');
          background-size: cover;
          background-position: center 30%;
          opacity: 0.08;
          z-index: 0;
        }
        .lp-hero-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 1;
          background:
            radial-gradient(ellipse 70% 60% at 10% 90%, rgba(102,98,255,0.25) 0%, transparent 65%),
            radial-gradient(ellipse 50% 50% at 90% 10%, rgba(166,162,255,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 50%, rgba(207,255,94,0.04) 0%, transparent 70%);
        }
        /* Geometric lines background element */
        .lp-hero-lines {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background-image:
            repeating-linear-gradient(
              -55deg,
              transparent,
              transparent 60px,
              rgba(102,98,255,0.04) 60px,
              rgba(102,98,255,0.04) 61px
            );
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(102,98,255,0.15);
          border: 1px solid rgba(102,98,255,0.35);
          border-radius: 100px; padding: 7px 16px;
          font-size: 13px; font-weight: 500; color: var(--brand-light);
          margin-bottom: 32px; animation: lp-fadeDown 0.6s ease both;
          position: relative; z-index: 2;
        }
        .lp-badge-dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--green-yellow);
          animation: lp-pulse 2s ease infinite;
          box-shadow: 0 0 8px var(--green-yellow);
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
          font-family: 'Syne', sans-serif;
          font-size: clamp(40px, 6.5vw, 84px); font-weight: 800; line-height: 1.05;
          text-align: center; max-width: 860px; color: var(--white);
          animation: lp-fadeUp 0.7s 0.15s ease both; position: relative; z-index: 2;
          letter-spacing: -0.03em;
        }
        .lp-hero-headline .accent { color: var(--brand-light); }
        .lp-hero-headline .accent-green { color: var(--green-yellow); }
        .lp-hero-sub {
          max-width: 560px; text-align: center; font-size: 18px; line-height: 1.7;
          color: rgba(255,255,255,0.55); margin-top: 24px; font-weight: 400;
          animation: lp-fadeUp 0.7s 0.3s ease both; position: relative; z-index: 2;
        }
        .lp-hero-sub strong { color: rgba(255,255,255,0.9); font-weight: 600; }
        .lp-hero-actions {
          display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
          margin-top: 40px; animation: lp-fadeUp 0.7s 0.45s ease both;
          position: relative; z-index: 2;
        }
        .lp-btn-primary {
          background: var(--brand); color: var(--white);
          font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700;
          padding: 16px 32px; border-radius: 10px; border: none; cursor: pointer;
          text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s; box-shadow: 0 4px 24px rgba(102,98,255,0.5);
        }
        .lp-btn-primary:hover { background: #5552EE; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(102,98,255,0.65); }
        .lp-btn-secondary {
          background: transparent; color: rgba(255,255,255,0.75);
          font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500;
          padding: 15px 28px; border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.15); cursor: pointer; text-decoration: none; transition: all 0.2s;
        }
        .lp-btn-secondary:hover { border-color: var(--brand-light); color: var(--brand-light); }
        .lp-hero-trust {
          margin-top: 16px; font-size: 13px; color: rgba(255,255,255,0.3);
          animation: lp-fadeUp 0.7s 0.55s ease both; position: relative; z-index: 2;
        }

        /* ── STATS BAR ── */
        .lp-stats-bar {
          background: var(--brand);
          padding: 40px 48px; display: flex; justify-content: center;
          position: relative; overflow: hidden;
        }
        .lp-stats-bar::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            -45deg, transparent, transparent 20px,
            rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 21px
          );
        }
        .lp-stat-item { text-align: center; padding: 0 60px; border-right: 1px solid rgba(255,255,255,0.15); position: relative; z-index: 1; }
        .lp-stat-item:last-child { border-right: none; }
        .lp-stat-number { font-family: 'Syne', sans-serif; font-size: 44px; font-weight: 800; color: var(--white); line-height: 1; letter-spacing: -0.03em; }
        .lp-stat-label { font-size: 14px; color: rgba(255,255,255,0.65); margin-top: 8px; }

        /* ── SHARED ── */
        .lp-section-label { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--brand); margin-bottom: 16px; }
        .lp-section-headline { font-family: 'Syne', sans-serif; font-size: clamp(30px, 4vw, 50px); font-weight: 800; text-align: center; color: var(--dark); max-width: 680px; line-height: 1.1; letter-spacing: -0.02em; }
        .lp-section-sub { text-align: center; font-size: 17px; line-height: 1.6; color: var(--text-muted); max-width: 540px; margin-top: 16px; }

        /* ── PROBLEM ── */
        .lp-problem-section { padding: 100px 48px; background: var(--off-white); display: flex; flex-direction: column; align-items: center; }
        .lp-problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1000px; margin-top: 60px; }
        .lp-problem-card {
          background: var(--white); border-radius: 16px; padding: 36px 32px;
          border: 1px solid var(--border); position: relative; overflow: hidden;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .lp-problem-card:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(102,98,255,0.1); }
        .lp-problem-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--brand), var(--brand-light), transparent); }
        .lp-problem-quote { font-size: 15px; line-height: 1.75; color: var(--text); font-style: italic; margin-bottom: 20px; }
        .lp-problem-quote strong { color: var(--dark); font-style: normal; font-weight: 600; }
        .lp-problem-persona { font-size: 13px; color: var(--text-muted); font-weight: 500; }

        /* ── FOR SECTION ── */
        .lp-for-section { padding: 100px 48px; background: var(--white); display: flex; flex-direction: column; align-items: center; }
        .lp-for-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1040px; margin-top: 56px; width: 100%; }
        .lp-for-card { border-radius: 20px; padding: 40px 32px; position: relative; overflow: hidden; transition: transform 0.25s, box-shadow 0.25s; cursor: default; }
        .lp-for-card:hover { transform: translateY(-5px); box-shadow: 0 24px 64px rgba(102,98,255,0.18); }
        .lp-for-card.explorer { background: var(--off-white); border: 1.5px solid var(--border); }
        .lp-for-card.builder { background: var(--dark); border: 1.5px solid rgba(102,98,255,0.2); }
        .lp-for-card.climber { background: var(--brand); border: 1.5px solid transparent; }
        .lp-for-tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; margin-bottom: 20px; }
        .explorer .lp-for-tag { background: rgba(102,98,255,0.12); color: var(--brand); }
        .builder .lp-for-tag { background: rgba(102,98,255,0.2); color: var(--brand-light); }
        .climber .lp-for-tag { background: rgba(255,255,255,0.18); color: var(--white); }
        .lp-for-age { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 8px; letter-spacing: -0.03em; }
        .explorer .lp-for-age { color: var(--dark); }
        .builder .lp-for-age { color: var(--white); }
        .climber .lp-for-age { color: var(--white); }
        .lp-for-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 12px; }
        .explorer .lp-for-title { color: var(--dark); }
        .builder .lp-for-title { color: var(--white); }
        .climber .lp-for-title { color: var(--white); }
        .lp-for-desc { font-size: 14px; line-height: 1.7; font-weight: 400; }
        .explorer .lp-for-desc { color: var(--text-muted); }
        .builder .lp-for-desc { color: rgba(255,255,255,0.55); }
        .climber .lp-for-desc { color: rgba(255,255,255,0.75); }
        .lp-for-list { list-style: none; margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
        .lp-for-list li { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
        .explorer .lp-for-list li { color: var(--text); }
        .builder .lp-for-list li { color: rgba(255,255,255,0.7); }
        .climber .lp-for-list li { color: rgba(255,255,255,0.9); }
        .lp-for-list li::before { content: '→'; font-size: 12px; opacity: 0.5; }
        .explorer .lp-for-list li::before { color: var(--brand); }
        .builder .lp-for-list li::before { color: var(--brand-light); }
        .climber .lp-for-list li::before { color: var(--green-yellow); }

        /* ── PILLARS ── */
        .lp-pillars-section { padding: 100px 48px; background: var(--dark); display: flex; flex-direction: column; align-items: center; position: relative; overflow: hidden; }
        .lp-pillars-section::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            -55deg, transparent, transparent 80px,
            rgba(102,98,255,0.03) 80px, rgba(102,98,255,0.03) 81px
          );
        }
        .lp-pillars-section .lp-section-label { color: var(--brand-light); position: relative; z-index: 1; }
        .lp-pillars-section .lp-section-headline { color: var(--white); position: relative; z-index: 1; }
        .lp-pillars-section .lp-section-sub { color: rgba(255,255,255,0.45); position: relative; z-index: 1; }
        .lp-pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1040px; margin-top: 56px; width: 100%; position: relative; z-index: 1; }
        .lp-pillar-card {
          background: rgba(255,255,255,0.04);
          border-radius: 20px; padding: 40px 32px;
          border: 1px solid rgba(102,98,255,0.1);
          position: relative; overflow: hidden;
          transition: border-color 0.25s, transform 0.25s, background 0.25s;
        }
        .lp-pillar-card:hover { border-color: rgba(102,98,255,0.4); transform: translateY(-3px); background: rgba(102,98,255,0.07); }
        .lp-pillar-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--brand), var(--brand-light), transparent); opacity: 0; transition: opacity 0.25s; }
        .lp-pillar-card:hover::before { opacity: 1; }
        .lp-pillar-icon { width: 52px; height: 52px; background: rgba(102,98,255,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 24px; border: 1px solid rgba(102,98,255,0.2); }
        .lp-pillar-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--white); margin-bottom: 12px; }
        .lp-pillar-desc { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.45); margin-bottom: 24px; }
        .lp-pillar-features { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .lp-pillar-features li { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.65); display: flex; align-items: flex-start; gap: 10px; }
        .lp-pillar-features li::before { content: '✓'; color: var(--brand-light); font-size: 13px; flex-shrink: 0; margin-top: 1px; }

        /* ── HOW IT WORKS ── */
        .lp-how-section { padding: 100px 48px; background: var(--off-white); display: flex; flex-direction: column; align-items: center; }
        .lp-steps-container { display: flex; align-items: flex-start; max-width: 900px; margin-top: 60px; width: 100%; position: relative; }
        .lp-steps-container::before { content: ''; position: absolute; top: 32px; left: calc(33.33% / 2); right: calc(33.33% / 2); height: 1.5px; background: linear-gradient(90deg, var(--brand), var(--brand-light), rgba(102,98,255,0.2)); }
        .lp-step { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 24px; }
        .lp-step-number { width: 64px; height: 64px; background: var(--white); border: 2px solid var(--brand); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--brand); margin-bottom: 24px; position: relative; z-index: 1; box-shadow: 0 0 0 6px var(--off-white), 0 4px 20px rgba(102,98,255,0.2); }
        .lp-step-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: var(--dark); margin-bottom: 10px; }
        .lp-step-desc { font-size: 14px; line-height: 1.7; color: var(--text-muted); }

        /* ── TESTIMONIALS ── */
        .lp-testimonials-section { padding: 100px 48px; background: var(--white); display: flex; flex-direction: column; align-items: center; }
        .lp-testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1040px; margin-top: 56px; width: 100%; }
        .lp-testimonial-card {
          background: var(--off-white); border-radius: 20px; padding: 36px;
          border: 1px solid var(--border); display: flex; flex-direction: column;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .lp-testimonial-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(102,98,255,0.12); }
        .lp-testimonial-card.featured { background: var(--brand); border-color: transparent; }
        .lp-testimonial-stars { display: flex; gap: 3px; margin-bottom: 20px; }
        .lp-star { color: var(--green-yellow); font-size: 16px; }
        .featured .lp-star { color: rgba(255,255,255,0.9); }
        .lp-testimonial-quote { font-size: 15px; line-height: 1.75; color: var(--text); flex: 1; margin-bottom: 24px; }
        .featured .lp-testimonial-quote { color: rgba(255,255,255,0.9); }
        .lp-testimonial-author { display: flex; align-items: center; gap: 12px; }
        .lp-author-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--brand), var(--brand-light)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: var(--white); flex-shrink: 0; }
        .featured .lp-author-avatar { background: rgba(255,255,255,0.2); }
        .lp-author-name { font-size: 14px; font-weight: 700; color: var(--dark); }
        .featured .lp-author-name { color: var(--white); }
        .lp-author-role { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .featured .lp-author-role { color: rgba(255,255,255,0.55); }

        /* ── MENTORS ── */
        .lp-mentors-section { padding: 100px 48px; background: var(--brand-pale); display: flex; flex-direction: column; align-items: center; }
        .lp-mentors-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 900px; margin-top: 56px; width: 100%; }
        .lp-mentor-card { background: var(--white); border-radius: 20px; padding: 32px; border: 1px solid var(--border); text-align: center; transition: transform 0.25s, box-shadow 0.25s; }
        .lp-mentor-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(102,98,255,0.15); }
        .lp-mentor-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--brand), var(--brand-light)); display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; color: var(--white); margin: 0 auto 16px; border: 3px solid rgba(102,98,255,0.15); }
        .lp-mentor-name { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: var(--dark); margin-bottom: 4px; }
        .lp-mentor-title { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5; }
        .lp-mentor-badge { display: inline-block; background: rgba(102,98,255,0.1); color: var(--brand); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; border: 1px solid rgba(102,98,255,0.2); }

        /* ── PRICING ── */
        .lp-pricing-section { padding: 100px 48px; background: var(--dark); display: flex; flex-direction: column; align-items: center; position: relative; overflow: hidden; }
        .lp-pricing-section::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(102,98,255,0.15) 0%, transparent 65%);
        }
        .lp-pricing-section .lp-section-label { color: var(--brand-light); position: relative; z-index: 1; }
        .lp-pricing-section .lp-section-headline { color: var(--white); position: relative; z-index: 1; }
        .lp-pricing-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 900px; margin-top: 56px; width: 100%; position: relative; z-index: 1; }
        .lp-pricing-card {
          background: rgba(255,255,255,0.04);
          border-radius: 20px; padding: 36px 28px;
          border: 1px solid rgba(102,98,255,0.1);
          transition: border-color 0.25s, transform 0.25s;
          position: relative;
        }
        .lp-pricing-card:hover { border-color: rgba(102,98,255,0.3); transform: translateY(-3px); }
        .lp-pricing-card.popular { border-color: var(--brand); background: rgba(102,98,255,0.12); }
        .lp-popular-tag { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--brand); color: var(--white); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 14px; border-radius: 100px; white-space: nowrap; }
        .lp-pricing-plan { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-light); margin-bottom: 16px; }
        .lp-pricing-price { font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 800; color: var(--white); line-height: 1; letter-spacing: -0.03em; }
        .lp-pricing-price span { font-size: 18px; font-weight: 400; color: rgba(255,255,255,0.35); font-family: 'Inter', sans-serif; }
        .lp-pricing-for { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 6px; margin-bottom: 28px; }
        .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
        .lp-pricing-features li { font-size: 13px; color: rgba(255,255,255,0.6); display: flex; align-items: flex-start; gap: 10px; line-height: 1.5; }
        .lp-pricing-features li::before { content: '✓'; color: var(--brand-light); font-size: 12px; flex-shrink: 0; margin-top: 2px; }
        .lp-pricing-btn { display: block; text-align: center; text-decoration: none; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 700; transition: all 0.2s; }
        .lp-pricing-btn.outline { border: 1.5px solid rgba(102,98,255,0.25); color: rgba(255,255,255,0.6); }
        .lp-pricing-btn.outline:hover { border-color: var(--brand); color: var(--brand-light); }
        .lp-pricing-btn.filled { background: var(--brand); color: var(--white); border: none; box-shadow: 0 4px 24px rgba(102,98,255,0.45); }
        .lp-pricing-btn.filled:hover { background: #5552EE; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(102,98,255,0.6); }

        /* ── CTA ── */
        .lp-cta-section { padding: 120px 48px; background: var(--white); display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden; }
        .lp-cta-section::before { content: ''; position: absolute; width: 900px; height: 900px; border-radius: 50%; background: radial-gradient(circle, rgba(102,98,255,0.06) 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .lp-cta-headline { font-family: 'Syne', sans-serif; font-size: clamp(36px, 5vw, 62px); font-weight: 800; color: var(--dark); max-width: 680px; line-height: 1.1; position: relative; z-index: 1; letter-spacing: -0.03em; }
        .lp-cta-headline .accent { color: var(--brand); }
        .lp-cta-sub { font-size: 17px; line-height: 1.7; color: var(--text-muted); max-width: 480px; margin-top: 20px; position: relative; z-index: 1; }
        .lp-cta-actions { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 40px; position: relative; z-index: 1; }
        .lp-cta-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
        .lp-btn-whatsapp { background: #25D366; color: white; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px; border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .lp-btn-whatsapp:hover { background: #1fba59; transform: translateY(-2px); }
        .lp-email-form { display: flex; max-width: 420px; width: 100%; margin-top: 8px; border-radius: 10px; overflow: hidden; border: 1.5px solid var(--border); box-shadow: 0 0 0 4px rgba(102,98,255,0.04); transition: box-shadow 0.2s; }
        .lp-email-form:focus-within { box-shadow: 0 0 0 4px rgba(102,98,255,0.12); border-color: var(--brand); }
        .lp-email-form input { flex: 1; padding: 14px 18px; font-family: 'Inter', sans-serif; font-size: 14px; color: var(--text); border: none; outline: none; background: var(--white); }
        .lp-email-form button { background: var(--brand); color: var(--white); border: none; padding: 14px 22px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
        .lp-email-form button:hover { background: #5552EE; }
        .lp-cta-note { font-size: 12px; color: var(--text-muted); margin-top: 12px; position: relative; z-index: 1; }

        /* ── FOOTER ── */
        .lp-footer { background: var(--dark); padding: 60px 48px 32px; }
        .lp-footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 48px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .lp-footer-brand { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: var(--white); margin-bottom: 12px; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em; }
        .lp-footer-brand-icon { width: 28px; height: 28px; background: var(--brand); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: white; font-style: italic; }
        .lp-footer-tagline { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.35); max-width: 260px; }
        .lp-footer-col-title { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 20px; }
        .lp-footer-links { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .lp-footer-links a { text-decoration: none; font-size: 14px; color: rgba(255,255,255,0.35); transition: color 0.2s; }
        .lp-footer-links a:hover { color: var(--brand-light); }
        .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 28px; font-size: 13px; color: rgba(255,255,255,0.25); }
        .lp-footer-bottom span:last-child { color: rgba(255,255,255,0.2); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .lp-nav { padding: 16px 24px; }
          .lp-nav-links { display: none; }
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
        }
      `}</style>

      <div className="lp-body">

        {/* NAV */}
        <nav className="lp-nav">
          <Link href="/" className="lp-nav-logo">
            <div className="lp-nav-logo-icon">A</div>
            Ascentor
          </Link>
          <ul className="lp-nav-links">
            <li><Link href="/who-its-for">Who It&apos;s For</Link></li>
            <li><Link href="/how-it-works">How It Works</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/blog" style={{ color: 'var(--text)' }}>Blog</Link></li>
            <li><Link href="/login" style={{ color: 'var(--text)' }}>Log In</Link></li>
            <li><Link href="/signup" className="lp-nav-cta">Start Free →</Link></li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-hero-img" />
          <div className="lp-hero-lines" />
          <div className="lp-hero-bg" />
          <div className="lp-badge">
            <div className="lp-badge-dot" />
            Now open — join 50+ early members across 15 countries
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
            <Link href="/who-its-for" className="lp-btn-secondary">See if it&apos;s for you</Link>
          </div>
          <p className="lp-hero-trust">No credit card required · Cancel anytime · 30-day money-back guarantee</p>
        </section>

        {/* STATS BAR */}
        <div className="lp-stats-bar">
          {[
            { number: '50+', label: 'Early members already growing' },
            { number: '15', label: 'African countries represented' },
            { number: '24/7', label: 'AI mentor — always available' },
            { number: '$15', label: 'vs $200/hr traditional coaching' },
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
              { quote: '"I\'ve been a manager for two years but I\'m still figuring it out alone. Executive coaching costs more than my rent."', persona: '— Kwame, 31. Team Lead, Accra' },
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
          <div className="lp-section-label">
            <Link href="/who-its-for" style={{ color: 'inherit', textDecoration: 'none' }}>Who Ascentor Is For →</Link>
          </div>
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
              <div className="lp-for-title">Building momentum</div>
              <p className="lp-for-desc">Early-career professionals and young entrepreneurs making their first real moves.</p>
              <ul className="lp-for-list">
                <li>Career strategy & positioning</li>
                <li>Access to industry mentors</li>
                <li>Entrepreneur mentorship tracks</li>
                <li>Live expert masterclasses</li>
              </ul>
            </div>
            <div className="lp-for-card climber">
              <span className="lp-for-tag">The Climber</span>
              <div className="lp-for-age">32–50</div>
              <div className="lp-for-title">Going to the top</div>
              <p className="lp-for-desc">Mid-career leaders, managers, and founders who are serious about reaching the summit.</p>
              <ul className="lp-for-list">
                <li>Executive-level mentorship</li>
                <li>Leadership & management coaching</li>
                <li>Peer cohorts of your equals</li>
                <li>Business strategy sessions</li>
              </ul>
            </div>
          </div>
        </section>

        {/* THREE PILLARS */}
        <section className="lp-pillars-section" id="pillars">
          <div className="lp-section-label">
            <Link href="/how-it-works" style={{ color: 'inherit', textDecoration: 'none' }}>How It Works →</Link>
          </div>
          <h2 className="lp-section-headline">Three pillars. One powerful platform.</h2>
          <p className="lp-section-sub">Everything you need to grow — AI, human mentors, and a community that holds you accountable.</p>
          <div className="lp-pillars-grid">
            <div className="lp-pillar-card">
              <div className="lp-pillar-icon">🤖</div>
              <div className="lp-pillar-title">AI Mentor</div>
              <p className="lp-pillar-desc">Your personal mentor, available at 2am before your big presentation. Trained on African business context, career frameworks, and life navigation.</p>
              <ul className="lp-pillar-features">
                <li>Personalized to your stage and goals</li>
                <li>Remembers your conversations</li>
                <li>Action plans after every session</li>
                <li>Career, life, and business guidance</li>
                <li>24/7 — never unavailable</li>
              </ul>
            </div>
            <div className="lp-pillar-card" style={{ borderColor: 'rgba(102,98,255,0.25)' }}>
              <div className="lp-pillar-icon">🎓</div>
              <div className="lp-pillar-title">Human Mentors & Expert Sessions</div>
              <p className="lp-pillar-desc">Live sessions with Africa's top professionals who've navigated the exact challenges you're facing. Real experience, not theory.</p>
              <ul className="lp-pillar-features">
                <li>Monthly live masterclasses</li>
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
              { n: '02', title: 'Meet your AI mentor', desc: 'Within 60 seconds, your AI mentor gives you a personalized action plan and matches you to the right human mentors and cohort.' },
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

        {/* TESTIMONIALS */}
        <section className="lp-testimonials-section">
          <div className="lp-section-label">Early Members</div>
          <h2 className="lp-section-headline">What they're saying</h2>
          <div className="lp-testimonials-grid">
            <div className="lp-testimonial-card featured">
              <div className="lp-testimonial-stars">{'★★★★★'.split('').map((s, i) => <span key={i} className="lp-star">{s}</span>)}</div>
              <p className="lp-testimonial-quote">"The AI mentor helped me prepare for a promotion conversation I'd been avoiding for months. It knew exactly what to say for my specific situation in a Nigerian corporate environment. I got the promotion."</p>
              <div className="lp-testimonial-author">
                <div className="lp-author-avatar">A</div>
                <div><div className="lp-author-name">Amara O.</div><div className="lp-author-role">Product Manager · Lagos</div></div>
              </div>
            </div>
            <div className="lp-testimonial-card">
              <div className="lp-testimonial-stars">{'★★★★★'.split('').map((s, i) => <span key={i} className="lp-star">{s}</span>)}</div>
              <p className="lp-testimonial-quote">"Having a cohort of peers in similar roles across Africa gave me perspectives I'd never find in my company alone. These people get it in a way my Western colleagues simply don't."</p>
              <div className="lp-testimonial-author">
                <div className="lp-author-avatar">D</div>
                <div><div className="lp-author-name">David K.</div><div className="lp-author-role">Engineering Lead · Nairobi</div></div>
              </div>
            </div>
            <div className="lp-testimonial-card">
              <div className="lp-testimonial-stars">{'★★★★★'.split('').map((s, i) => <span key={i} className="lp-star">{s}</span>)}</div>
              <p className="lp-testimonial-quote">"At $15/month, this replaces the $200/session executive coach I couldn't afford. And honestly? The AI is more available and more nuanced about my actual context."</p>
              <div className="lp-testimonial-author">
                <div className="lp-author-avatar">F</div>
                <div><div className="lp-author-name">Fatima H.</div><div className="lp-author-role">Strategy Consultant · Accra</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* MENTOR SPOTLIGHT */}
        <section className="lp-mentors-section">
          <div className="lp-section-label">Founding Mentors</div>
          <h2 className="lp-section-headline">Learn from people who've been there</h2>
          <p className="lp-section-sub" style={{ color: 'var(--text-muted)' }}>
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
          <p style={{ marginTop: '40px', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Are you an experienced professional?{' '}
            <Link href="/mentor-apply" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>Apply to become a Founding Mentor →</Link>
          </p>
        </section>

        {/* PRICING */}
        <section className="lp-pricing-section" id="pricing">
          <div className="lp-section-label">Simple Pricing</div>
          <h2 className="lp-section-headline">World-class mentorship at African prices</h2>
          <div className="lp-pricing-cards">
            <div className="lp-pricing-card">
              <div className="lp-pricing-plan">Explorer</div>
              <div className="lp-pricing-price">$5<span>/mo</span></div>
              <div className="lp-pricing-for">For students & graduates (15–22)</div>
              <ul className="lp-pricing-features">
                <li>AI mentor — career discovery mode</li>
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
                <li>Unlimited AI mentor sessions</li>
                <li>Live expert masterclasses</li>
                <li>All mentorship circles</li>
                <li>1-on-1 mentor booking (2/month)</li>
                <li>Full course library</li>
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
                <li>Priority AI mentor responses</li>
                <li>Unlimited 1-on-1 mentor sessions</li>
                <li>Private executive cohort</li>
                <li>Live Q&A priority access</li>
                <li>1-on-1 onboarding call</li>
              </ul>
              <Link href="/pricing" className="lp-pricing-btn outline">Start Free Trial</Link>
            </div>
          </div>
          <p style={{ marginTop: '32px', fontSize: '14px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            Looking for team or corporate plans?{' '}
            <Link href="/contact" style={{ color: 'var(--brand-light)', textDecoration: 'none' }}>Talk to us →</Link>
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
              <a href="https://chat.whatsapp.com/HGWexQqTh5XE2VT8DhbDnx" className="lp-btn-whatsapp" target="_blank" rel="noreferrer">
                💬 Join our Founders WhatsApp Community
              </a>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Or get weekly mentorship insights — free</p>
            {subscribed ? (
              <p style={{ fontSize: '14px', color: 'var(--brand)', fontWeight: 600 }}>✓ You're in! Check your inbox.</p>
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
              <div className="lp-footer-brand">
                <div className="lp-footer-brand-icon">A</div>
                Ascentor
              </div>
              <p className="lp-footer-tagline">Africa's mentorship platform — from figuring it out to making it happen.</p>
            </div>
            <div>
              <div className="lp-footer-col-title">Platform</div>
              <ul className="lp-footer-links">
                <li><Link href="/who-its-for">Who It&apos;s For</Link></li>
                <li><Link href="/how-it-works">How It Works</Link></li>
                <li><Link href="/pricing">Pricing</Link></li>
                <li><Link href="/blog">Blog</Link></li>
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
                <li><a href="mailto:hello@ascentor.co">hello@ascentor.co</a></li>
                <li><a href="https://x.com/ascentor" target="_blank" rel="noreferrer">Twitter / X</a></li>
                <li><a href="https://linkedin.com/company/ascentor" target="_blank" rel="noreferrer">LinkedIn</a></li>
                <li><a href="https://wa.me/234XXXXXXXXXX" target="_blank" rel="noreferrer">WhatsApp Community</a></li>
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
