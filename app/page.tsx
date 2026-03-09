'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [hasBlogPosts, setHasBlogPosts] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);

  // B7: Check if blog has published posts — hide nav link when empty
  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .then(({ count }) => { if ((count || 0) > 0) setHasBlogPosts(true); });

    supabase
      .from('products')
      .select('id, name, tagline, price, currency, image_url, category, badge, cta_label')
      .eq('published', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true })
      .limit(3)
      .then(({ data }) => { if (data?.length) setFeaturedProducts(data); });
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
          background-image: url('/hero-bg.jpg');
          background-size: cover;
          background-position: center 40%;
          opacity: 0.28;
          z-index: 0;
        }
        .lp-hero-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 1;
          background:
            linear-gradient(to bottom, rgba(253,252,249,0.65) 0%, rgba(253,252,249,0.15) 40%, rgba(253,252,249,0.75) 100%),
            radial-gradient(ellipse 60% 50% at 15% 80%, rgba(232,160,32,0.14) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 85% 20%, rgba(232,160,32,0.10) 0%, transparent 60%);
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
        .lp-testimonial-stars { display: flex; gap: 4px; margin-bottom: 20px; align-items: center; }
        .lp-star { display: flex; align-items: center; color: var(--gold); }
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

        /* ── PRODUCTS ── */
        .lp-products-section { padding: 100px 48px; background: var(--light); display: flex; flex-direction: column; align-items: center; }
        .lp-products-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1000px; margin-top: 56px; width: 100%; }
        .lp-product-card { background: var(--white); border-radius: 20px; overflow: hidden; border: 1px solid rgba(232,160,32,0.1); text-decoration: none; color: inherit; transition: transform 0.25s, box-shadow 0.25s; display: flex; flex-direction: column; }
        .lp-product-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(232,160,32,0.1); }
        .lp-product-img { aspect-ratio: 16/9; background: #EDE9E3; position: relative; overflow: hidden; }
        .lp-product-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
        .lp-product-card:hover .lp-product-img img { transform: scale(1.04); }
        .lp-product-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 36px; }
        .lp-product-badge { position: absolute; top: 10px; left: 10px; background: var(--dark); color: var(--gold); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; }
        .lp-product-body { padding: 20px; flex: 1; display: flex; flex-direction: column; }
        .lp-product-cat { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); margin-bottom: 6px; display: block; }
        .lp-product-name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 700; color: var(--dark); margin-bottom: 6px; line-height: 1.2; }
        .lp-product-tagline { font-size: 13px; color: var(--text-light); line-height: 1.5; flex: 1; margin-bottom: 16px; }
        .lp-product-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid rgba(232,160,32,0.1); }
        .lp-product-price { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 700; color: var(--dark); }
        .lp-product-price.free { color: #14B8A6; }
        .lp-product-cta { font-size: 12px; font-weight: 700; color: var(--gold); }

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
          .lp-testimonials-grid, .lp-mentors-grid, .lp-products-grid { grid-template-columns: 1fr; }
          .lp-steps-container { flex-direction: column; gap: 40px; }
          .lp-steps-container::before { display: none; }
          .lp-footer-top { grid-template-columns: 1fr 1fr; }
          .lp-problem-section, .lp-for-section, .lp-pillars-section, .lp-how-section,
          .lp-testimonials-section, .lp-mentors-section,
          .lp-products-section, .lp-cta-section { padding: 72px 24px; }
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
            <li><Link href="/about">About</Link></li>
            <li><Link href="/who-its-for">Who It's For</Link></li>
            <li><Link href="/how-it-works">How It Works</Link></li>
            <li><Link href="/products">Products</Link></li>
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
            <Link href="/about" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>About</Link>
            <Link href="/who-its-for" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>Who It's For</Link>
            <Link href="/how-it-works" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link href="/products" className="lp-drawer-link" onClick={() => setMobileMenuOpen(false)}>Products</Link>
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
              <div className="lp-pillar-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--gold)'}}>
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <path d="M12 2a2 2 0 0 1 2 2v1H10V4a2 2 0 0 1 2-2z"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                  <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none"/>
                  <path d="M12 19v1"/>
                </svg>
              </div>
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
              <div className="lp-pillar-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--gold)'}}>
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <div className="lp-pillar-title">Human Mentors &amp; Live Sessions</div>
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
              <div className="lp-pillar-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--gold)'}}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
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
              { icon: 'lock',  title: 'Locked-in pricing', desc: 'Your founding rate is yours for life — never increases as the platform grows.' },
              { icon: 'mic',   title: 'Shape the roadmap', desc: 'Direct line to the founding team. Your feedback ships in weeks, not quarters.' },
              { icon: 'globe', title: 'Founding community', desc: 'The first circle of African professionals building careers with intention.' },
            ].map((card) => (
              <div key={card.title} style={{ background: 'var(--light)', borderRadius: '20px', padding: '32px 28px', border: '1px solid rgba(42,40,32,0.06)' }}>
                <div style={{ width: 44, height: 44, background: 'rgba(232,160,32,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  {card.icon === 'lock' && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  )}
                  {card.icon === 'mic' && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  )}
                  {card.icon === 'globe' && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  )}
                </div>
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
              <a href="https://chat.whatsapp.com/FLHef9sbMywIcdxH0MJCsl?mode=gi_t" className="lp-btn-whatsapp" target="_blank" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.528 5.845L0 24l6.341-1.507A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.794 9.794 0 0 1-5.012-1.376l-.36-.214-3.766.895.942-3.667-.234-.374A9.789 9.789 0 0 1 2.182 12C2.182 6.578 6.578 2.182 12 2.182S21.818 6.578 21.818 12 17.422 21.818 12 21.818z"/>
                </svg>
                Join Founders WhatsApp Community
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

        {/* PRODUCTS */}
        {featuredProducts.length > 0 && (
          <section className="lp-products-section">
            <div className="lp-section-label">From the Shop</div>
            <h2 className="lp-section-headline">Resources built for African ambition</h2>
            <p className="lp-section-sub">Playbooks, templates, and tools you can use today.</p>
            <div className="lp-products-grid">
              {featuredProducts.map(p => (
                <Link key={p.id} href={`/products/${p.id}`} className="lp-product-card">
                  <div className="lp-product-img">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} />
                      : <div className="lp-product-img-placeholder">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                            <line x1="12" y1="22.08" x2="12" y2="12"/>
                          </svg>
                        </div>
                    }
                    {p.badge && <span className="lp-product-badge">{p.badge}</span>}
                  </div>
                  <div className="lp-product-body">
                    <span className="lp-product-cat">{p.category}</span>
                    <h3 className="lp-product-name">{p.name}</h3>
                    <p className="lp-product-tagline">{p.tagline}</p>
                    <div className="lp-product-footer">
                      <span className={`lp-product-price${p.price === 0 ? ' free' : ''}`}>
                        {p.price === 0 ? 'Free' : `${p.currency} ${p.price}`}
                      </span>
                      <span className="lp-product-cta">
                        {p.cta_label || (p.price === 0 ? 'Get Free →' : 'Buy Now →')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/products" className="lp-btn-secondary" style={{ marginTop: '40px' }}>
              See all products →
            </Link>
          </section>
        )}

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-top">
            <div>
              <img
                  src="/ascentor-color-for-dark-pages.svg"
                  alt="Ascentor"
                  style={{ height: '28px', width: 'auto', marginBottom: '12px' }}
                />
              <p className="lp-footer-tagline">Africa's mentorship platform — from figuring it out to making it happen.</p>
            </div>
            <div>
              <div className="lp-footer-col-title">Platform</div>
              <ul className="lp-footer-links">
                <li><Link href="/products">Products</Link></li>
                {hasBlogPosts && <li><Link href="/blog">Blog</Link></li>}
                <li><Link href="https://ascentor.zohobookings.com/#/4738058000000052054">For Teams</Link></li>
                <li><Link href="/mentor-apply">Become a Mentor</Link></li>
                <li><Link href="/signup">Start Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <div className="lp-footer-col-title">Company</div>
              <ul className="lp-footer-links">
                <li><Link href="/about">About</Link></li>
                <li><Link href="/terms">Terms & Conditions</Link></li>
                <Link href="/privacy">Privacy Policy</Link>
                <li><Link href="/newsletter">Newsletter</Link></li>
                <li><Link href="/careers">Careers</Link></li>
              </ul>
            </div>
            <div>
              <div className="lp-footer-col-title">Connect</div>
              <ul className="lp-footer-links">
                <li><a href="mailto:asamuel@ascentorbi.com">hello@ascentorbi.com</a></li>
                <li><a href="https://x.com/ascentorhq" target="_blank" rel="noreferrer">Twitter / X</a></li>
                <li><a href="https://linkedin.com/company/ascentorhq" target="_blank" rel="noreferrer">LinkedIn</a></li>
                <li><a href="https://www.instagram.com/ascentor.ai/" target="_blank" rel="noreferrer">Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Ascentor. All rights reserved.</span>
            <span>Built with <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--gold)" stroke="none" style={{display:'inline',verticalAlign:'middle',margin:'0 2px'}}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> for Africa</span>
          </div>
        </footer>

      </div>
    </>
  );
}
