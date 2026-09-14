"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";

// ─── Types ────────────────────────────────────────────────────────────────────
type ContactItem = { label: string; value: string };
type TableRow = { purpose: string; detail: string };

type Block =
  | { type: "para"; text: string }
  | { type: "highlight"; text: string }
  | { type: "subheading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; rows: TableRow[] }
  | { type: "contact"; items: ContactItem[] };

type Section = {
  id: string;
  num: string;
  title: string;
  content: Block[];
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
        text: `Ascentor ("we", "our", or "us") is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, store, and share your information when you use our platform - including our website, mobile Progressive Web App (PWA), and all related services.`,
      },
      {
        type: "para",
        text: "By creating an account or using Ascentor, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our services.",
      },
      {
        type: "highlight",
        text: "We do not sell your personal data. We do not show you third-party advertisements. Ascentor's business model is subscription-based - your data is never our product.",
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
          "Account registration data - name, email address, password (hashed, never stored in plain text)",
          "Profile information - current role, goal role, industry, career summary, biggest challenge",
          "Onboarding responses - experience level, life stage (Explorer / Builder / Climber), mentorship goals",
          "Mentor application data - if you apply to become a mentor: LinkedIn URL, professional background, availability",
          "Community content - posts, replies, and upvotes you create in Accountability Circles",
          "Payment information - billing cycle and plan selected; card details are processed by Paystack and never stored on Ascentor servers",
          "Referral codes - if you share or use a referral link",
          "Support communications - messages you send to our team",
        ],
      },
      { type: "subheading", text: "Information Collected Automatically" },
      {
        type: "list",
        items: [
          "Usage data - pages visited, features used, session duration, button clicks",
          "Device information - browser type, operating system, screen size, PWA install status",
          "Sage AI session data - your conversation inputs with our AI mentor and the responses generated",
          "Learning progress - video completion percentage, last playback position, completed courses",
          "Goal and commitment activity - 90-day goals created, milestones updated, commitments checked",
          "Expert session registrations - which sessions you register for and attend",
          "Push notification subscription data - device endpoint for delivering notifications (no personally identifiable data in the subscription itself)",
        ],
      },
      { type: "subheading", text: "Information from Third Parties" },
      {
        type: "list",
        items: [
          "Google OAuth - if you sign in with Google, we receive your name and email address from Google. We do not receive your Google password or access to your Google account beyond authentication.",
          "Paystack - payment status and transaction reference for verifying subscription payments. We receive confirmation of payment, not your card details.",
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
          { purpose: "AI coaching (Sage)", detail: "Your conversation history with Sage is processed through Anthropic's Claude API to generate contextual, relevant responses. Your data is not used to train Anthropic's models." },
          { purpose: "Match you with peer cohorts", detail: "Onboarding data (industry, experience level, goals) drives the algorithm that places you in the right Accountability Circle." },
          { purpose: "Process subscriptions & payments", detail: "Plan selection, billing cycle, and payment confirmations are handled via Paystack. We never store card numbers." },
          { purpose: "Send relevant communications", detail: "Service emails (billing receipts, session reminders, platform updates) and, with consent, occasional marketing emails." },
          { purpose: "Improve the product", detail: "Anonymised usage analytics help us refine features, fix bugs, and prioritise the roadmap." },
          { purpose: "Security & fraud prevention", detail: "Login anomalies, suspicious payment activity, and abuse detection protect both you and the community." },
          { purpose: "Comply with legal obligations", detail: "We retain certain data to meet tax, financial reporting, and data protection requirements." },
        ],
      },
    ],
  },
  {
    id: "data-sharing",
    num: "04",
    title: "When We Share Your Data",
    content: [
      {
        type: "para",
        text: "We never sell your data. We share it only in the specific, limited circumstances below:",
      },
      {
        type: "table",
        rows: [
          { purpose: "Service providers", detail: "Supabase (database & auth), Anthropic (AI coaching), Paystack/Selar (payments), Vercel (hosting), Google Analytics (anonymised). All processors sign DPAs." },
          { purpose: "Legal requests", detail: "When compelled by court order, subpoena, or regulatory authority. We will notify you unless legally prohibited." },
          { purpose: "Business transfers", detail: "In a merger, acquisition, or asset sale, your data may transfer as part of the business. You will be notified and your rights preserved." },
          { purpose: "Safety emergencies", detail: "If we believe disclosure is necessary to prevent imminent harm to a person." },
        ],
      },
    ],
  },
  {
    id: "data-retention",
    num: "05",
    title: "How Long We Keep Your Data",
    content: [
      {
        type: "table",
        rows: [
          { purpose: "Account & profile", detail: "Until you delete your account. Deleted within 30 days of request." },
          { purpose: "Sage AI conversations", detail: "Retained for the life of your account unless you delete individual sessions." },
          { purpose: "Community posts", detail: "Retained while account is active; anonymised upon account deletion." },
          { purpose: "Payment & billing", detail: "7 years (tax & financial regulation)." },
          { purpose: "Analytics (anonymised)", detail: "Indefinitely - aggregated, no personal identifiers." },
          { purpose: "Security logs", detail: "12 months." },
        ],
      },
    ],
  },
  {
    id: "your-rights",
    num: "06",
    title: "Your Rights",
    content: [
      {
        type: "para",
        text: "Under NDPR, NDPA, and (where applicable) GDPR, you have the following rights:",
      },
      {
        type: "list",
        items: [
          "Access - request a copy of all personal data we hold about you.",
          "Rectification - correct inaccurate or incomplete data.",
          "Erasure - delete your account and all associated data (except what we must retain legally).",
          "Restriction - limit processing of your data in certain circumstances.",
          "Portability - receive your data in a structured, machine-readable format.",
          "Objection - object to processing based on legitimate interests or direct marketing.",
          "Withdraw consent - at any time, for any consent-based processing (e.g., marketing emails).",
        ],
      },
      {
        type: "para",
        text: "To exercise any right, email joinascentor@gmail.com or joinascentor@gmail.com. We respond within 30 days.",
      },
    ],
  },
  {
    id: "security",
    num: "07",
    title: "How We Protect Your Data",
    content: [
      {
        type: "list",
        items: [
          "Encryption in transit (TLS 1.2+) and at rest (AES-256) on Supabase/AWS infrastructure.",
          "Row-Level Security (RLS) on every database table - users can only ever access their own rows.",
          "Supabase Auth handles authentication with OAuth 2.0 (Google, LinkedIn) and encrypted session cookies.",
          "Service-role keys are server-side only - never exposed to the client.",
          "Regular security audits, dependency scanning, and access logging.",
          "Incident response plan with 72-hour breach notification to affected users and regulators.",
        ],
      },
    ],
  },
  {
    id: "international-transfers",
    num: "08",
    title: "International Data Transfers",
    content: [
      {
        type: "para",
        text: "Ascentor is operated from Nigeria. Your data may be processed in the United States (Supabase on AWS, Anthropic) and Europe (Vercel). We rely on Standard Contractual Clauses (SCCs) and the EU-US Data Privacy Framework where applicable to ensure adequate protection.",
      },
    ],
  },
  {
    id: "children",
    num: "09",
    title: "Children's Privacy",
    content: [
      {
        type: "para",
        text: "Ascentor is not directed at individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided us with data, contact us and we will delete it.",
      },
    ],
  },
  {
    id: "changes",
    num: "10",
    title: "Changes to This Policy",
    content: [
      {
        type: "para",
        text: "We may update this Privacy Policy from time to time. Material changes will be communicated via email or in-app notification at least 14 days before they take effect. Continued use after changes constitutes acceptance. The 'Last updated' date at the top reflects the most recent revision.",
      },
    ],
  },
  {
    id: "contact",
    num: "11",
    title: "Contact Us",
    content: [
      {
        type: "contact",
        items: [
          { label: "General & Data Rights", value: "joinascentor@gmail.com" },
          { label: "Data Protection Officer", value: "joinascentor@gmail.com" },
          { label: "Postal Address", value: "Lekki, Lagos, Nigeria" },
        ],
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
    }
  }

  function renderBlock(block: Block, i: number) {
    switch (block.type) {
      case "para":
        return <p key={i} className="privacy-para" dangerouslySetInnerHTML={{ __html: block.text }} />;
      case "highlight":
        return <p key={i} className="privacy-highlight" dangerouslySetInnerHTML={{ __html: block.text }} />;
      case "subheading":
        return <h3 key={i} className="privacy-subheading">{block.text}</h3>;
      case "list":
        return (
          <ul key={i} className="privacy-list">
            {block.items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item }} />)}
          </ul>
        );
      case "table":
        return (
          <table key={i} className="privacy-table">
            <thead>
              <tr>
                <th>Purpose / Category</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j}>
                  <td dangerouslySetInnerHTML={{ __html: row.purpose }} />
                  <td dangerouslySetInnerHTML={{ __html: row.detail }} />
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "contact":
        return (
          <div key={i} className="contact-grid">
            {block.items.map((item, j) => (
              <div key={j} className="contact-card">
                <p className="contact-label">{item.label}</p>
                <p className="contact-value">
                  {item.value.includes("@") ? (
                    <a href={`mailto:${item.value}`}>{item.value}</a>
                  ) : item.value.startsWith("http") ? (
                    <a href={item.value} target="_blank" rel="noopener noreferrer">{item.value}</a>
                  ) : (
                    item.value
                  )}
                </p>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <div className="privacy-page">
      <PublicHeader />
      <ProgressBar />

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
          We built Ascentor to serve purposeful individuals - not to monetise their data.
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
              onClick={() => scrollTo(s.id)}
            >
              <span className="toc-item-num">{s.num}</span>
              <span className="toc-item-text">{s.title}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
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

      {/* Mobile TOC overlay - closes drawer when tapped outside */}
      {menuOpen && (
        <div className="mobile-toc-overlay" onClick={() => setMenuOpen(false)} />
      )}

      <button
        className="mobile-toc-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? "✕ Close" : "≡ Contents"}
      </button>

      <div className={`mobile-toc-drawer ${menuOpen ? "open" : ""}`}>
        <div className="mobile-toc-handle" />
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`toc-item ${activeSection === s.id ? "active" : ""}`}
            onClick={() => scrollTo(s.id)}
            style={{ borderLeft: "2px solid transparent" }}
          >
            <span className="toc-item-num">{s.num}</span>
            <span className="toc-item-text">{s.title}</span>
          </button>
        ))}
      </div>

      <PublicFooter />
      </div>
    </>
  );
}

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