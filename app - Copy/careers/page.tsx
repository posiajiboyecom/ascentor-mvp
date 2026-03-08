'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ============================================================
// CAREERS PAGE — /careers
// Public-facing. Pulls live job listings from Supabase via API.
// Ascentor brand: Dark #0C0B08 · Gold #E8A020 · Syne · DM Mono · Cormorant Garamond
// ============================================================

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string; // 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
  mode: string; // 'Remote' | 'Hybrid' | 'On-site'
  description: string;
  requirements: string[];
  nice_to_have: string[];
  apply_url: string | null;
  apply_email: string | null;
  is_active: boolean;
  created_at: string;
}

const DEPARTMENTS = ['All', 'Engineering', 'Product', 'Design', 'Marketing', 'Operations', 'Content', 'Partnerships'];

export default function CareersPage() {
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dept, setDept]           = useState('All');
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => { fetchJobs(); }, []);

  async function fetchJobs() {
    try {
      const res = await fetch('/api/careers');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error('Failed to load jobs:', e);
    }
    setLoading(false);
  }

  const filtered = dept === 'All'
    ? jobs.filter(j => j.is_active)
    : jobs.filter(j => j.is_active && j.department === dept);

  const depts = ['All', ...Array.from(new Set(jobs.filter(j => j.is_active).map(j => j.department)))];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #0C0B08; }

        .cr-root {
          min-height: 100vh;
          background: #0C0B08;
          font-family: 'Syne', sans-serif;
          color: #D4CFC3;
        }

        /* ── Nav ── */
        .cr-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid rgba(212,207,195,0.08);
          position: sticky;
          top: 0;
          background: rgba(12,11,8,0.92);
          backdrop-filter: blur(12px);
          z-index: 50;
        }
        @media (max-width: 600px) { .cr-nav { padding: 16px 20px; } }

        /* ── Hero ── */
        .cr-hero {
          text-align: center;
          padding: 100px 24px 80px;
          position: relative;
          overflow: hidden;
        }
        .cr-hero::before {
          content: '';
          position: absolute;
          top: -100px; left: 50%; transform: translateX(-50%);
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(232,160,32,0.07) 0%, transparent 65%);
          pointer-events: none;
        }
        .cr-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(232,160,32,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,160,32,0.02) 1px, transparent 1px);
          background-size: 56px 56px;
          pointer-events: none;
        }
        .cr-hero-inner { position: relative; z-index: 1; max-width: 680px; margin: 0 auto; }

        /* ── Filter tabs ── */
        .cr-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          padding: 0 24px 48px;
        }
        .cr-filter-btn {
          padding: 7px 16px;
          border-radius: 100px;
          border: 1px solid #2E2A22;
          background: transparent;
          color: #7A7260;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cr-filter-btn:hover { border-color: #E8A020; color: #E8A020; }
        .cr-filter-btn.active {
          background: rgba(232,160,32,0.1);
          border-color: #E8A020;
          color: #E8A020;
        }

        /* ── Jobs ── */
        .cr-jobs {
          max-width: 760px;
          margin: 0 auto;
          padding: 0 24px 100px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cr-job-card {
          background: #141310;
          border: 1px solid #2E2A22;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .cr-job-card:hover { border-color: #4A4438; }

        .cr-job-header {
          padding: 20px 24px;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .cr-job-body {
          padding: 0 24px 24px;
          border-top: 1px solid #2E2A22;
          animation: cr-expand 0.2s ease both;
        }
        @keyframes cr-expand {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Empty / Loading ── */
        .cr-empty {
          text-align: center;
          padding: 80px 24px;
          color: #4A4438;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* ── CTA strip ── */
        .cr-cta {
          background: #141310;
          border-top: 1px solid #2E2A22;
          padding: 80px 24px;
          text-align: center;
        }

        .cr-apply-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 28px;
          background: #E8A020;
          color: #0C0B08;
          border: none;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s;
        }
        .cr-apply-btn:hover { background: #F5C55A; }

        .cr-ghost-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: transparent;
          color: #7A7260;
          border: 1px solid #2E2A22;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: border-color 0.15s, color 0.15s;
        }
        .cr-ghost-btn:hover { border-color: #E8A020; color: #E8A020; }
      `}</style>

      <div className="cr-root">

        {/* ── Nav ── */}
        <nav className="cr-nav">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: 28 }} />
          </Link>
          <Link href="/login" className="cr-apply-btn" style={{ padding: '9px 20px', fontSize: 13 }}>
            Sign In
          </Link>
        </nav>

        {/* ── Hero ── */}
        <section className="cr-hero">
          <div className="cr-hero-inner">
            <p style={{
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#E8A020', marginBottom: 20,
            }}>
              Ascentor Careers
            </p>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(40px, 7vw, 72px)',
              fontWeight: 700, lineHeight: 1.05,
              color: '#FEF9EC', margin: '0 0 20px',
              letterSpacing: '-1px',
            }}>
              Build the platform<br />Africa deserves.
            </h1>
            <p style={{
              fontSize: 16, color: '#7A7260',
              lineHeight: 1.7, maxWidth: 480, margin: '0 auto 36px',
            }}>
              We're a small team with an outsized mission — democratising mentorship
              across Africa. Every role here shapes what that looks like.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Remote-first', },
                { label: 'Pan-African', },
                { label: 'Mission-driven', },
              ].map(p => (
                <span key={p.label} style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 10,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#4A4438', padding: '5px 14px',
                  border: '1px solid #2E2A22', borderRadius: 100,
                }}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Department filters ── */}
        <div className="cr-filters">
          {depts.map(d => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`cr-filter-btn${dept === d ? ' active' : ''}`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* ── Job listings ── */}
        <div className="cr-jobs">
          {loading ? (
            <div className="cr-empty">Loading open roles...</div>
          ) : filtered.length === 0 ? (
            <div className="cr-empty">
              No open roles in this department right now.<br />
              <span style={{ marginTop: 8, display: 'block' }}>Check back soon or send a speculative application below.</span>
            </div>
          ) : filtered.map(job => (
            <div key={job.id} className="cr-job-card">
              <div
                className="cr-job-header"
                onClick={() => setExpanded(expanded === job.id ? null : job.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Tags row */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[job.department, job.type, job.mode].map(tag => (
                      <span key={tag} style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 9,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: '#7A7260', padding: '2px 8px',
                        background: '#1E1C17', border: '1px solid #2E2A22',
                        borderRadius: 100,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 22, fontWeight: 700,
                    color: '#FEF9EC', margin: '0 0 6px', lineHeight: 1.2,
                  }}>
                    {job.title}
                  </h3>
                  <p style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 11,
                    color: '#4A4438', letterSpacing: '0.06em', margin: 0,
                    textTransform: 'uppercase',
                  }}>
                    {job.location}
                  </p>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  border: '1px solid #2E2A22', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#7A7260', fontSize: 14,
                  transition: 'transform 0.2s, border-color 0.2s',
                  transform: expanded === job.id ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                  ▾
                </div>
              </div>

              {expanded === job.id && (
                <div className="cr-job-body">
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: '#7A7260', marginBottom: 24, marginTop: 20 }}>
                    {job.description}
                  </p>

                  {job.requirements?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 10,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: '#E8A020', marginBottom: 12,
                      }}>
                        What we're looking for
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {job.requirements.map((r, i) => (
                          <li key={i} style={{ fontSize: 14, color: '#D4CFC3', lineHeight: 1.6 }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {job.nice_to_have?.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <p style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 10,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: '#4A4438', marginBottom: 12,
                      }}>
                        Nice to have
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {job.nice_to_have.map((r, i) => (
                          <li key={i} style={{ fontSize: 14, color: '#7A7260', lineHeight: 1.6 }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Apply CTA */}
                  {job.apply_url ? (
                    <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="cr-apply-btn">
                      Apply for this role →
                    </a>
                  ) : job.apply_email ? (
                    <a href={`mailto:${job.apply_email}?subject=Application: ${job.title}`} className="cr-apply-btn">
                      Apply via Email →
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Speculative / CTA strip ── */}
        <div className="cr-cta">
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32, fontWeight: 700,
            color: '#FEF9EC', marginBottom: 12, lineHeight: 1.2,
          }}>
            Don't see your role?
          </p>
          <p style={{ fontSize: 14, color: '#7A7260', marginBottom: 32, lineHeight: 1.7 }}>
            We're always interested in exceptional people. Send us a note.
          </p>
          <a href="mailto:asamuel@ascentorbi.com" className="cr-apply-btn">
            Send a speculative application →
          </a>
        </div>

      </div>
    </>
  );
}
