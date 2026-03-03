"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Discriminated union types — fixes Bug #10 ───────────────────────────────
type ParaBlock      = { type: "para";      text: string };
type HighlightBlock = { type: "highlight"; text: string };
type SubheadingBlock= { type: "subheading";text: string };
type ListBlock      = { type: "list";      items: string[] };
type TableBlock     = { type: "table";     rows: { purpose: string; detail: string }[] };
type ContactBlock   = { type: "contact";   items: { label: string; value: string }[] };

type ContentBlock =
  | ParaBlock
  | HighlightBlock
  | SubheadingBlock
  | ListBlock
  | TableBlock
  | ContactBlock;

type Section = {
  id: string;
  num: string;
  title: string;
  content: ContentBlock[];
};

// ─── Section data ─────────────────────────────────────────────────────────────
const SECTIONS: Section[] = [
  {
    id: "overview",
    num: "01",
    title: "Overview",
    content: [
      {
        type: "para",
        text: "Ascentor (\u201cwe\u201d, \u201cour\u201d, or \u201cus\u201d) is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, store, and share your information when you use our platform \u2014 including our website, mobile Progressive Web App (PWA), and all related services.",
      },
      {
        type: "para",
        text: "By creating an account or using Ascentor, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our services.",
      },
      {
        type: "highlight",
        text: "We do not sell your personal data. We do not show you third-party advertisements. Ascentor\u2019s business model is subscription-based \u2014 your data is never our product.",
      },
    ],
  },
  {
    id: "information-we-collect",
    num: "02",
    title: "Information We Collect",
    content: [
      { type: "subheading", text: "Information You Provide Directly" },
      {
        type: "list",
        items: [
          "Account registration data \u2014 name, email address, password (hashed, never stored in plain text)",
          "Profile information \u2014 current role, goal role, industry, career summary, biggest challenge",
          "Onboarding responses \u2014 experience level, life stage (Explorer / Builder / Climber), mentorship goals",
          "Mentor application data \u2014 if you apply to become a mentor: LinkedIn URL, professional background, availability",
          "Community content \u2014 posts, replies, and upvotes you create in Mentorship Circles",
          "Payment information \u2014 billing cycle and plan selected; card details are processed by Paystack and never stored on Ascentor servers",
          "Referral codes \u2014 if you share or use a referral link",
          "Support communications \u2014 messages you send to our team",
        ],
      },
      { type: "subheading", text: "Information Collected Automatically" },
      {
        type: "list",
        items: [
          "Usage data \u2014 pages visited, features used, session duration, button clicks",
          "Device information \u2014 browser type, operating system, screen size, PWA install status",
          "Sage AI session data \u2014 your conversation inputs with our AI mentor and the responses generated",
          "Learning progress \u2014 video completion percentage, last playback position, completed courses",
          "Goal and commitment activity \u2014 90-day goals created, milestones updated, commitments checked",
          "Expert session registrations \u2014 which sessions you register for and attend",
          "Push notification subscription data \u2014 device endpoint for delivering notifications (no personally identifiable data in the subscription itself)",
        ],
      },
      { type: "subheading", text: "Information from Third Parties" },
      {
        type: "list",
        items: [
          "Google OAuth \u2014 if you sign in with Google, we receive your name and email address from Google. We do not receive your Google password or access to your Google account beyond authentication.",
          "Paystack \u2014 payment status and transaction reference for verifying subscription payments. We receive confirmation of payment, not your card details.",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    num: "03",
    title: "How We Use Your Information",
    content: [
      {
        type: "para",
        text: "We use the information we collect for the following purposes, all of which are necessary to provide you with a meaningful mentorship experience:",
      },
      {
        type: "table",
        rows: [
          { purpose: "Provide & personalise the platform", detail: "Your profile, goals, and career stage directly shape how Sage AI responds to you and which content and experts are surfaced." },
          { purpose: "Process subscriptions & payments", detail: "To activate your plan, verify Paystack transactions, and apply promotional discounts." },
          { purpose: "Deliver AI mentor sessions (Sage)", detail: "Your session inputs are sent to Anthropic\u2019s Claude API to generate a response. Inputs are stored to power session history and continuity." },
          { purpose: "Send notifications", detail: "In-app and push notifications for circle activity, upvotes, expert session reminders, and platform updates." },
          { purpose: "Track learning progress", detail: "To resume video playback, mark courses complete, and show your progress in the Learn library." },
          { purpose: "Community moderation", detail: "To enforce our Community Guidelines and respond to reports of harmful content." },
          { purpose: "Analytics & product improvement", detail: "Aggregated, anonymised usage patterns help us understand which features are valuable and where the product needs improvement." },
          { purpose: "Security & fraud prevention", detail: "To detect suspicious activity, enforce rate limits, and protect accounts from unauthorised access." },
          { purpose: "Referral bonuses", detail: "To track and credit referral incentives when you invite someone who subscribes." },
          { purpose: "Legal compliance", detail: "To comply with applicable laws, respond to lawful requests, and enforce our Terms of Service." },
        ],
      },
    ],
  },
  {
    id: "ai-data",
    num: "04",
    title: "Sage AI & Your Conversations",
    content: [
      { type: "highlight", text: "Conversations with Sage are personal. We treat them with care." },
      {
        type: "para",
        text: "When you start a Sage AI mentor session, your input is sent to Anthropic\u2019s API (claude-sonnet model) to generate a structured response. The following applies:",
      },
      {
        type: "list",
        items: [
          "Your Sage session inputs and AI responses are stored in our database (Supabase/PostgreSQL) linked to your user ID, so you can access your history.",
          "We do not use your Sage conversations to train AI models \u2014 neither our own nor Anthropic\u2019s.",
          "Anthropic processes your inputs under their own Privacy Policy and API Data Use terms. They do not use API inputs to train their models by default.",
          "Sage session data is only accessible to you (your history) and to our engineering team for debugging purposes, subject to strict access controls.",
          "You can request deletion of your Sage session history at any time by contacting us.",
        ],
      },
      {
        type: "para",
        text: "The four session types (Navigate a Challenge, Prep a Conversation, Weekly Reflection, Accountability Check) each use a distinct system prompt. Your session type selection is stored alongside your input and response.",
      },
    ],
  },
  {
    id: "data-sharing",
    num: "05",
    title: "How We Share Your Information",
    content: [
      {
        type: "para",
        text: "We do not sell, rent, or trade your personal information. We share data only in the following limited circumstances:",
      },
      {
        type: "list",
        items: [
          "Service providers \u2014 Supabase (database & auth), Anthropic (AI processing), Paystack (payments), Vercel (hosting). Each is bound by data processing agreements.",
          "Other users \u2014 your display name, profile role, and community posts are visible to other Ascentor members within Mentorship Circles you join.",
          "Expert mentors \u2014 if you register for a live Expert Session, your name may be shared with the session host for facilitation purposes.",
          "Legal requirements \u2014 we may disclose information if required to do so by law, regulation, or valid legal process (e.g. court order).",
          "Business transfers \u2014 if Ascentor is acquired or merges with another entity, your data may be transferred as part of that transaction. We will notify you in advance.",
          "With your explicit consent \u2014 for any other purpose not listed here, we will ask you first.",
        ],
      },
    ],
  },
  {
    id: "data-retention",
    num: "06",
    title: "Data Retention",
    content: [
      {
        type: "para",
        text: "We retain your personal data for as long as your account is active or as needed to provide our services. Specifically:",
      },
      {
        type: "list",
        items: [
          "Active account data \u2014 retained for the lifetime of your account.",
          "Sage session history \u2014 retained indefinitely unless you request deletion.",
          "Payment records \u2014 retained for 7 years to comply with financial regulations.",
          "Audit logs \u2014 retained for 12 months for security and compliance purposes.",
          "Deletion requests \u2014 processed within 30 days. After deletion, anonymised aggregate data (e.g. total sessions count) may be retained for analytics.",
          "Push notification subscriptions \u2014 deleted automatically when a device endpoint returns an expired or invalid response.",
        ],
      },
    ],
  },
  {
    id: "your-rights",
    num: "07",
    title: "Your Rights & Choices",
    content: [
      {
        type: "para",
        text: "Depending on your location, you may have the following rights regarding your personal data:",
      },
      {
        type: "list",
        items: [
          "Access \u2014 request a copy of the personal data we hold about you.",
          "Correction \u2014 request that we correct inaccurate or incomplete data.",
          "Deletion \u2014 request deletion of your account and personal data. You can initiate this from Settings \u2192 Account \u2192 Delete Account, or by emailing us.",
          "Portability \u2014 request an export of your data in a machine-readable format.",
          "Restrict processing \u2014 request that we limit how we use your data in certain circumstances.",
          "Withdraw consent \u2014 where processing is based on consent (e.g. push notifications), you may withdraw it at any time without affecting prior processing.",
          "Opt out of marketing \u2014 you can unsubscribe from email communications at any time via the unsubscribe link or in your notification preferences.",
        ],
      },
      {
        type: "para",
        text: "To exercise any of these rights, contact us at privacy@ascentor.co. We will respond within 30 days. We may need to verify your identity before processing your request.",
      },
    ],
  },
  {
    id: "security",
    num: "08",
    title: "Security",
    content: [
      {
        type: "para",
        text: "We take reasonable technical and organisational measures to protect your personal data against unauthorised access, loss, or misuse. Our security measures include:",
      },
      {
        type: "list",
        items: [
          "Row-Level Security (RLS) on all database tables \u2014 users can only access their own data",
          "HTTPS/TLS encryption in transit across all endpoints",
          "Passwords hashed using Supabase Auth\u2019s bcrypt implementation \u2014 never stored in plain text",
          "Session-based authentication \u2014 payment and sensitive operations require a verified server-side session",
          "API route middleware \u2014 all sensitive API endpoints are protected and return 401 for unauthenticated requests",
          "Password re-authentication required for account changes \u2014 current password must be verified before updates",
          "Server-side validation \u2014 promotional codes and payment amounts validated server-side only",
          "Audit logs \u2014 sensitive actions (account deletion requests, plan changes) are logged",
        ],
      },
      {
        type: "para",
        text: "No system is 100% secure. If you discover a vulnerability, please report it responsibly to security@ascentor.co. We are committed to addressing security issues promptly.",
      },
    ],
  },
  {
    id: "cookies",
    num: "09",
    title: "Cookies & Tracking",
    content: [
      {
        type: "para",
        text: "Ascentor uses cookies and similar technologies for the following purposes:",
      },
      {
        type: "list",
        items: [
          "Authentication cookies \u2014 set by Supabase Auth to maintain your logged-in session. These are strictly necessary and cannot be disabled.",
          "Preference cookies \u2014 to remember your notification preferences and UI settings.",
          "Analytics \u2014 we may use anonymised, aggregated analytics to understand platform usage. No advertising-based tracking is used.",
        ],
      },
      {
        type: "para",
        text: "We do not use third-party advertising cookies, cross-site tracking pixels, or any technology designed to track you across websites for advertising purposes.",
      },
    ],
  },
  {
    id: "children",
    num: "10",
    title: "Children & Young Users",
    content: [
      {
        type: "para",
        text: "Ascentor is designed to serve professionals from age 15 upward \u2014 our Explorer tier specifically targets students aged 15\u201322. For users under the age of 18:",
      },
      {
        type: "list",
        items: [
          "We recommend that parents or guardians review this Privacy Policy with their child before account creation.",
          "We do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, contact us at privacy@ascentor.co and we will delete it promptly.",
          "Users between 13 and 18 use the platform under the assumption that a parent or guardian has reviewed and accepted these terms on their behalf.",
        ],
      },
    ],
  },
  {
    id: "international",
    num: "11",
    title: "International Data Transfers",
    content: [
      {
        type: "para",
        text: "Ascentor is based in Nigeria and primarily serves African professionals. However, our service providers (Supabase, Anthropic, Vercel) may process data in the United States and other countries.",
      },
      {
        type: "para",
        text: "Where data is transferred outside your country of residence, we ensure appropriate safeguards are in place through contractual agreements with our service providers that require them to protect your data to standards consistent with this policy.",
      },
    ],
  },
  {
    id: "changes",
    num: "12",
    title: "Changes to This Policy",
    content: [
      {
        type: "para",
        text: "We may update this Privacy Policy periodically to reflect changes in our practices, technology, legal requirements, or for other operational reasons. When we make material changes, we will:",
      },
      {
        type: "list",
        items: [
          "Update the \u2018Last updated\u2019 date at the top of this page",
          "Send an in-app notification to all active users",
          "For significant changes, send an email notification to your registered email address",
        ],
      },
      {
        type: "para",
        text: "Your continued use of Ascentor after changes take effect constitutes your acceptance of the revised policy.",
      },
    ],
  },
  {
    id: "contact",
    num: "13",
    title: "Contact Us",
    content: [
      {
        type: "para",
        text: "If you have questions, concerns, or requests regarding this Privacy Policy or how we handle your data, please reach out:",
      },
      {
        type: "contact",
        items: [
          { label: "Privacy enquiries", value: "privacy@ascentor.co" },
          { label: "Security reports",  value: "security@ascentor.co" },
          { label: "General support",   value: "hello@ascentor.co" },
          { label: "Platform",          value: "ascentor-mvp.vercel.app" },
        ],
      },
      {
        type: "para",
        text: "We aim to respond to all privacy-related requests within 30 days.",
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [scrolled,      setScrolled]      = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  // FIX #13 — renamed from scrollTo to avoid shadowing window.scrollTo
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMenuOpen(false);
    }
  };

  // FIX #10 — type-safe block renderer using discriminated union
  const renderBlock = (block: ContentBlock, i: number) => {
    switch (block.type) {
      case "para":
        return <p key={i} className="para">{block.text}</p>;

      case "highlight":
        return <div key={i} className="highlight-box">{block.text}</div>;

      case "subheading":
        return <div key={i} className="subheading">{block.text}</div>;

      case "list":
        // FIX #1 — items is now guaranteed string[] by type, no ! needed
        return (
          <ul key={i} className="privacy-list">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        );

      case "table":
        // FIX #2 — rows is now guaranteed by type, no ! needed
        return (
          <table key={i} className="privacy-table">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>How we use your information</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j}>
                  <td>{row.purpose}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case "contact":
        // FIX #3/#4 — contact items are {label, value}[], now type-safe
        return (
          <div key={i} className="contact-grid">
            {block.items.map((item, j) => (
              <div key={j} className="contact-card">
                <div className="contact-label">{item.label}</div>
                <div className="contact-value">{item.value}</div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* FIX #11 — Google Fonts loaded via <link> in <head>, not @import inside <style> */}
      {/* In Next.js App Router, add these tags to your root layout.tsx instead:        */}
      {/* <link rel="preconnect" href="https://fonts.googleapis.com" />                  */}
      {/* <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />      */}
      {/* <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" /> */}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --black:  #0C0B08;
          --slate:  #181612;
          --card:   #1E1C18;
          --border: #2E2A22;
          --gold:   #E8A020;
          --goldD:  #B9760A;
          --goldL:  #F5C842;
          --white:  #F0EDE8;
          --muted:  #9A9080;
          --dim:    #5C5548;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--black);
          color: var(--white);
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          line-height: 1.7;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* FIX #5 — replaced broken SVG noise (non-functional in most browsers) with
           a CSS-only subtle radial grain that actually renders */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(232,160,32,0.03) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(232,160,32,0.02) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Nav ── */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 0 2rem;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.3s, border-color 0.3s;
          border-bottom: 1px solid transparent;
        }
        .nav.scrolled {
          background: rgba(12, 11, 8, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-color: var(--border);
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--white);
        }
        .nav-logo-icon { width: 32px; height: 32px; }
        .nav-logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.3rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .nav-back {
          font-family: 'DM Mono', monospace;
          font-size: 0.75rem;
          color: var(--muted);
          text-decoration: none;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        .nav-back:hover { color: var(--gold); }

        /* ── Hero ── */
        .hero {
          position: relative;
          padding: 140px 2rem 80px;
          max-width: 900px;
          margin: 0 auto;
          z-index: 1;
        }
        .hero-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 1.2rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hero-eyebrow::before {
          content: '';
          display: inline-block;
          width: 28px;
          height: 1px;
          background: var(--gold);
        }
        .hero-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(3rem, 7vw, 5.5rem);
          font-weight: 700;
          line-height: 1.04;
          letter-spacing: -0.02em;
          color: var(--white);
          margin-bottom: 1.5rem;
        }
        .hero-title span { color: var(--gold); font-style: italic; }
        .hero-meta {
          display: flex;
          align-items: center;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .hero-meta-item {
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          color: var(--dim);
          letter-spacing: 0.06em;
        }
        .hero-meta-item strong { color: var(--muted); font-weight: 500; }
        .hero-divider {
          width: 60px;
          height: 3px;
          background: linear-gradient(90deg, var(--gold), transparent);
          margin: 2.5rem 0;
        }
        .hero-summary {
          font-size: 1.05rem;
          color: var(--muted);
          max-width: 620px;
          line-height: 1.8;
        }

        /* ── Layout ── */
        .layout {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem 8rem;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 4rem;
          align-items: start;
        }

        /* ── TOC Sidebar ── */
        .toc {
          position: sticky;
          top: 88px;
          padding: 1.5rem 0;
        }
        .toc-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--dim);
          margin-bottom: 1.2rem;
          padding-left: 1rem;
        }
        .toc-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 1rem;
          cursor: pointer;
          border-left: 2px solid transparent;
          transition: all 0.2s;
          text-decoration: none;
          width: 100%;
          background: none;
          border-top: none;
          border-right: none;
          border-bottom: none;
          text-align: left;
        }
        .toc-item:hover .toc-item-text { color: var(--white); }
        .toc-item.active {
          border-left-color: var(--gold);
          background: rgba(232, 160, 32, 0.05);
        }
        .toc-item.active .toc-item-num { color: var(--gold); }
        .toc-item.active .toc-item-text { color: var(--white); }
        .toc-item-num {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          color: var(--dim);
          min-width: 22px;
          transition: color 0.2s;
        }
        .toc-item-text {
          font-size: 0.82rem;
          color: var(--muted);
          transition: color 0.2s;
          line-height: 1.3;
        }

        /* ── Content ── */
        .content { padding-top: 0.5rem; }

        .section {
          margin-bottom: 5rem;
          scroll-margin-top: 96px;
        }
        .section-header {
          display: flex;
          align-items: baseline;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1.2rem;
          border-bottom: 1px solid var(--border);
        }
        .section-num {
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          color: var(--gold);
          letter-spacing: 0.1em;
          flex-shrink: 0;
        }
        .section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.9rem;
          font-weight: 600;
          color: var(--white);
          letter-spacing: -0.01em;
          line-height: 1.1;
        }
        .para {
          color: var(--muted);
          font-size: 0.95rem;
          line-height: 1.85;
          margin-bottom: 1.2rem;
        }
        .subheading {
          font-family: 'Syne', sans-serif;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--white);
          margin: 2rem 0 0.8rem;
        }
        .highlight-box {
          background: rgba(232, 160, 32, 0.07);
          border: 1px solid rgba(232, 160, 32, 0.25);
          border-left: 3px solid var(--gold);
          border-radius: 0 8px 8px 0;
          padding: 1.2rem 1.5rem;
          margin: 1.5rem 0;
          font-size: 0.95rem;
          color: var(--white);
          line-height: 1.7;
        }
        .privacy-list {
          list-style: none;
          margin: 0.5rem 0 1.2rem;
        }
        .privacy-list li {
          display: flex;
          gap: 0.9rem;
          padding: 0.55rem 0;
          font-size: 0.92rem;
          color: var(--muted);
          line-height: 1.7;
          border-bottom: 1px solid rgba(46, 42, 34, 0.5);
        }
        .privacy-list li:last-child { border-bottom: none; }
        .privacy-list li::before {
          content: '\2014';
          color: var(--gold);
          flex-shrink: 0;
          margin-top: 1px;
          font-family: 'DM Mono', monospace;
          font-size: 0.8rem;
        }

        /* Table */
        .privacy-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.88rem;
        }
        .privacy-table thead th {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--gold);
          text-align: left;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          background: rgba(232, 160, 32, 0.04);
        }
        .privacy-table tbody tr {
          border-bottom: 1px solid rgba(46, 42, 34, 0.6);
          transition: background 0.15s;
        }
        .privacy-table tbody tr:hover { background: rgba(255,255,255,0.02); }
        .privacy-table tbody tr:last-child { border-bottom: none; }
        .privacy-table td {
          padding: 0.9rem 1rem;
          vertical-align: top;
          line-height: 1.65;
        }
        .privacy-table td:first-child {
          color: var(--white);
          font-weight: 500;
          width: 38%;
          font-size: 0.85rem;
        }
        .privacy-table td:last-child { color: var(--muted); }

        /* Contact */
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin: 1.2rem 0;
        }
        .contact-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1.2rem 1.4rem;
          transition: border-color 0.2s;
        }
        .contact-card:hover { border-color: rgba(232, 160, 32, 0.4); }
        .contact-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--dim);
          margin-bottom: 0.4rem;
        }
        .contact-value {
          font-size: 0.9rem;
          color: var(--gold);
          font-weight: 500;
        }

        /* FIX #6 — Mobile drawer: was display:none which prevented .open from ever showing.
           Now uses visibility + opacity + pointer-events instead, with transform for slide.
           display:block is always set on mobile so the transition can actually play. */
        .mobile-toc-toggle {
          display: none;
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 90;
          background: var(--gold);
          color: var(--black);
          border: none;
          border-radius: 50px;
          padding: 0.75rem 1.25rem;
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .mobile-toc-drawer {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 95;
          background: var(--slate);
          border-top: 1px solid var(--border);
          border-radius: 20px 20px 0 0;
          padding: 1.5rem 1.5rem 3rem;
          max-height: 70vh;
          overflow-y: auto;
          /* FIX: hidden via transform + visibility, NOT display:none */
          transform: translateY(100%);
          visibility: hidden;
          transition: transform 0.3s ease, visibility 0.3s ease;
        }
        .mobile-toc-drawer.open {
          transform: translateY(0);
          visibility: visible;
        }
        .mobile-toc-handle {
          width: 40px;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          margin: 0 auto 1.5rem;
        }

        /* FIX #7 — Mobile toc items: removed inline borderLeft style override
           (was conflicting with .active CSS border-left rule). Handled in JSX below. */
        .mobile-toc-drawer .toc-item {
          border-left: 2px solid transparent;
        }

        /* ── Footer ── */
        .footer {
          position: relative;
          z-index: 1;
          border-top: 1px solid var(--border);
          padding: 2.5rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .footer-brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--muted);
        }
        .footer-brand span { color: var(--gold); }
        .footer-links { display: flex; gap: 1.5rem; }
        .footer-links a {
          font-family: 'DM Mono', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          color: var(--dim);
          text-decoration: none;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        .footer-links a:hover { color: var(--gold); }

        /* ── Progress bar ── */
        .progress-bar {
          position: fixed;
          top: 0; left: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--gold), var(--goldL));
          z-index: 200;
          transition: width 0.1s linear;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; gap: 2rem; }
          .toc { display: none; }
          /* FIX #6 cont. — on mobile, toggle + drawer use display:block so
             transform transitions work correctly */
          .mobile-toc-toggle { display: block; }
          .mobile-toc-drawer { display: block; }
          .contact-grid { grid-template-columns: 1fr; }
          .hero { padding: 120px 1.5rem 60px; }
          .layout { padding: 0 1.5rem 6rem; }
        }
        @media (max-width: 600px) {
          .hero-title { font-size: 2.6rem; }
          .section-title { font-size: 1.5rem; }
          .nav { padding: 0 1.5rem; }
        }
      `}</style>

      <ProgressBar />

      {/* Nav */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
        <Link href="/" className="nav-logo">
          <svg className="nav-logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,3 30,28 2,28"      fill="#E8A020" />
            <polygon points="16,9.5 26.5,27 5.5,27" fill="#0C0B08" />
            <rect x="7.5" y="19" width="17" height="3" fill="#E8A020" />
          </svg>
          <span className="nav-logo-text">Ascentor</span>
        </Link>
        <Link href="/nav/dashboard" className="nav-back">← Back to app</Link>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-eyebrow">Privacy Policy</div>
        <h1 className="hero-title">
          Your data,<br />
          <span>your trust.</span>
        </h1>
        <div className="hero-meta">
          <span className="hero-meta-item"><strong>Effective</strong> March 2026</span>
          <span className="hero-meta-item"><strong>Last updated</strong> March 2026</span>
          <span className="hero-meta-item"><strong>Version</strong> 1.0</span>
        </div>
        <div className="hero-divider" />
        <p className="hero-summary">
          We built Ascentor to serve African professionals — not to monetise their data.
          This policy explains exactly what we collect, why we collect it, and how you stay in control.
        </p>
      </header>

      {/* Main layout */}
      <div className="layout">
        {/* Desktop TOC */}
        <aside className="toc">
          <div className="toc-label">Contents</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`toc-item ${activeSection === s.id ? "active" : ""}`}
              onClick={() => scrollToSection(s.id)}
            >
              <span className="toc-item-num">{s.num}</span>
              <span className="toc-item-text">{s.title}</span>
            </button>
          ))}
        </aside>

        {/* Content — FIX #10: renderBlock() uses proper switch with discriminated union */}
        <main className="content">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="section">
              <div className="section-header">
                <span className="section-num">{section.num}</span>
                <h2 className="section-title">{section.title}</h2>
              </div>
              {section.content.map((block, i) => renderBlock(block, i))}
            </section>
          ))}
        </main>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-brand">
          <span>Ascentor</span> — Everyone who made it had someone.
        </div>
        <div className="footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@ascentor.co">Contact</a>
        </div>
      </footer>

      {/* Mobile TOC toggle */}
      <button
        className="mobile-toc-toggle"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Close contents" : "Open contents"}
      >
        {menuOpen ? "✕ Close" : "≡ Contents"}
      </button>

      {/* FIX #6 + #7 — drawer visibility via CSS class, no inline style overrides */}
      <div className={`mobile-toc-drawer ${menuOpen ? "open" : ""}`}>
        <div className="mobile-toc-handle" />
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`toc-item ${activeSection === s.id ? "active" : ""}`}
            onClick={() => scrollToSection(s.id)}
            // FIX #7 — removed `style={{ borderLeft: "2px solid transparent" }}`
            // which was overriding the .active CSS border-left-color rule
          >
            <span className="toc-item-num">{s.num}</span>
            <span className="toc-item-text">{s.title}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar() {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setWidth(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <div className="progress-bar" style={{ width: `${width}%` }} />;
}
