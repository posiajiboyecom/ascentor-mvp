'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// CAREERS PAGE — /careers
// Public-facing. Inline application form per job listing.
// Ascentor brand: Dark #0C0B08 · Gold #E8A020 · Syne · DM Mono · Cormorant Garamond
// ============================================================

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  mode: string;
  description: string;
  requirements: string[];
  nice_to_have: string[];
  apply_url: string | null;
  apply_email: string | null;
  is_active: boolean;
  created_at: string;
}

const DEPARTMENTS = ['All', 'Engineering', 'Product', 'Design', 'Marketing', 'Operations', 'Content', 'Partnerships'];

const EMPTY_APP = {
  full_name: '',
  email: '',
  phone: '',
  location: '',
  linkedin_url: '',
  portfolio_url: '',
  cover_letter: '',
  years_experience: '',
  how_did_you_hear: '',
};

export default function CareersPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [jobs, setJobs]             = useState<Job[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dept, setDept]             = useState('All');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);  // job.id currently showing form
  const [submitted, setSubmitted]   = useState<string | null>(null);  // job.id successfully applied
  const [submitting, setSubmitting] = useState(false);
  const [appForm, setAppForm]       = useState({ ...EMPTY_APP });
  const [appError, setAppError]     = useState('');
  const [cvFile, setCvFile]         = useState<File | null>(null);
  const [cvUploading, setCvUploading] = useState(false);

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

  function setField(key: keyof typeof EMPTY_APP, val: string) {
    setAppForm(f => ({ ...f, [key]: val }));
    setAppError('');
  }

  function openApply(jobId: string) {
    setApplyingTo(jobId);
    setAppForm({ ...EMPTY_APP });
    setAppError('');
    setCvFile(null);
  }

  async function uploadCV(jobId: string): Promise<string | null> {
    if (!cvFile) return null;
    setCvUploading(true);
    const ext = cvFile.name.split('.').pop();
    const path = `applications/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('resumes').upload(path, cvFile, { upsert: false });
    setCvUploading(false);
    if (error) { setAppError(`CV upload failed: ${error.message}`); return null; }
    const { data } = supabase.storage.from('resumes').getPublicUrl(path);
    return data.publicUrl;
  }

  async function submitApplication(job: Job) {
    if (!appForm.full_name.trim()) return setAppError('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appForm.email)) return setAppError('Please enter a valid email address.');
    if (!appForm.cover_letter.trim() || appForm.cover_letter.trim().length < 50)
      return setAppError('Please write a short cover letter (at least 50 characters).');
    if (cvFile) {
      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowed.includes(cvFile.type)) return setAppError('Please upload a PDF or Word document (.pdf, .doc, .docx).');
      if (cvFile.size > 5 * 1024 * 1024) return setAppError('CV must be under 5MB.');
    }

    setSubmitting(true);
    const cvUrl = await uploadCV(job.id);
    if (cvFile && !cvUrl) { setSubmitting(false); return; } // upload error already set

    try {
      const { error } = await supabase.from('job_applications').insert({
        job_id:           job.id,
        job_title:        job.title,
        department:       job.department,
        full_name:        appForm.full_name.trim(),
        email:            appForm.email.trim().toLowerCase(),
        phone:            appForm.phone.trim() || null,
        location:         appForm.location.trim() || null,
        linkedin_url:     appForm.linkedin_url.trim() || null,
        portfolio_url:    appForm.portfolio_url.trim() || null,
        cover_letter:     appForm.cover_letter.trim(),
        years_experience: appForm.years_experience || null,
        how_did_you_hear: appForm.how_did_you_hear || null,
        cv_url:           cvUrl,
        cv_filename:      cvFile ? cvFile.name : null,
        status:           'new',
      });
      if (error) throw error;
      setSubmitted(job.id);
      setApplyingTo(null);
    } catch (e: any) {
      setAppError(e?.message || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
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

        /* ── Application form ── */
        .cr-app-form {
          border-top: 1px solid #2E2A22;
          padding: 28px 24px 32px;
          animation: cr-expand 0.22s ease both;
        }
        .cr-app-form-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 700;
          color: #FEF9EC; margin: 0 0 4px;
        }
        .cr-app-form-sub {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: #4A4438; margin: 0 0 24px;
        }
        .cr-field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        @media (max-width: 600px) { .cr-field-row { grid-template-columns: 1fr; } }
        .cr-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
        .cr-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #7A7260;
        }
        .cr-input {
          background: #1A1710; border: 1px solid #2E2A22; border-radius: 8px;
          padding: 10px 14px; color: #D4CFC3;
          font-family: 'Syne', sans-serif; font-size: 14px;
          outline: none; transition: border-color 0.15s; width: 100%;
          box-sizing: border-box;
        }
        .cr-input:focus { border-color: rgba(232,160,32,0.5); }
        .cr-input::placeholder { color: #3A3830; }
        .cr-textarea { resize: vertical; min-height: 110px; }
        .cr-select {
          background: #1A1710; border: 1px solid #2E2A22; border-radius: 8px;
          padding: 10px 14px; color: #D4CFC3;
          font-family: 'Syne', sans-serif; font-size: 14px;
          outline: none; width: 100%; box-sizing: border-box;
          appearance: none; cursor: pointer;
        }
        .cr-select:focus { border-color: rgba(232,160,32,0.5); }
        .cr-app-error {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px; padding: 10px 14px;
          font-family: 'DM Mono', monospace; font-size: 11px;
          color: #F87171; margin-bottom: 16px;
        }
        .cr-form-actions { display: flex; gap: 12px; align-items: center; margin-top: 20px; flex-wrap: wrap; }
        .cr-cancel-btn {
          background: transparent; border: 1px solid #2E2A22; border-radius: 8px;
          padding: 11px 22px; color: #7A7260;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .cr-cancel-btn:hover { border-color: #4A4438; color: #A09880; }
        .cr-success-banner {
          border-top: 1px solid #2E2A22;
          padding: 24px;
          background: rgba(232,160,32,0.04);
          display: flex; align-items: flex-start; gap: 14px;
          animation: cr-expand 0.2s ease both;
        }
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
              Build something<br />the world deserves.
            </h1>
            <p style={{
              fontSize: 16, color: '#7A7260',
              lineHeight: 1.7, maxWidth: 480, margin: '0 auto 36px',
            }}>
              We're a small team with an outsized mission — democratising mentorship
              across the world. Every role here shapes what that looks like.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Remote-first', },
                { label: 'global', },
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

                  {/* Apply section */}
                  {submitted === job.id ? (
                    <div className="cr-success-banner">
                      <span style={{ fontSize: 22 }}>✓</span>
                      <div>
                        <p style={{ margin: '0 0 4px', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: '#FEF9EC' }}>
                          Application received.
                        </p>
                        <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#7A7260', letterSpacing: '0.04em', lineHeight: 1.6 }}>
                          We review every application personally. You'll hear from us within 5–7 business days.
                        </p>
                      </div>
                    </div>
                  ) : applyingTo === job.id ? (
                    <div className="cr-app-form">
                      <p className="cr-app-form-title">Apply — {job.title}</p>
                      <p className="cr-app-form-sub">{job.department} · {job.type} · {job.mode}</p>

                      <div className="cr-field-row">
                        <div className="cr-field">
                          <label className="cr-label">Full Name *</label>
                          <input className="cr-input" placeholder="Tunde Adeyemi"
                            value={appForm.full_name} onChange={e => setField('full_name', e.target.value)} />
                        </div>
                        <div className="cr-field">
                          <label className="cr-label">Email Address *</label>
                          <input className="cr-input" type="email" placeholder="tunde@email.com"
                            value={appForm.email} onChange={e => setField('email', e.target.value)} />
                        </div>
                      </div>

                      <div className="cr-field-row">
                        <div className="cr-field">
                          <label className="cr-label">Phone (optional)</label>
                          <input className="cr-input" placeholder="+234 800 000 0000"
                            value={appForm.phone} onChange={e => setField('phone', e.target.value)} />
                        </div>
                        <div className="cr-field">
                          <label className="cr-label">Your Location</label>
                          <input className="cr-input" placeholder="Lagos, Nigeria"
                            value={appForm.location} onChange={e => setField('location', e.target.value)} />
                        </div>
                      </div>

                      <div className="cr-field-row">
                        <div className="cr-field">
                          <label className="cr-label">LinkedIn URL</label>
                          <input className="cr-input" placeholder="linkedin.com/in/yourprofile"
                            value={appForm.linkedin_url} onChange={e => setField('linkedin_url', e.target.value)} />
                        </div>
                        <div className="cr-field">
                          <label className="cr-label">Portfolio / GitHub</label>
                          <input className="cr-input" placeholder="github.com/yourhandle"
                            value={appForm.portfolio_url} onChange={e => setField('portfolio_url', e.target.value)} />
                        </div>
                      </div>

                      <div className="cr-field-row">
                        <div className="cr-field">
                          <label className="cr-label">Years of Experience</label>
                          <select className="cr-select" value={appForm.years_experience} onChange={e => setField('years_experience', e.target.value)}>
                            <option value="">Select...</option>
                            {['0–1 years', '1–3 years', '3–5 years', '5–8 years', '8–12 years', '12+ years'].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <div className="cr-field">
                          <label className="cr-label">How did you hear about us?</label>
                          <select className="cr-select" value={appForm.how_did_you_hear} onChange={e => setField('how_did_you_hear', e.target.value)}>
                            <option value="">Select...</option>
                            {['LinkedIn', 'Twitter / X', 'Referral', 'Google', 'Newsletter', 'Community', 'Other'].map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="cr-field">
                        <label className="cr-label">CV / Resume <span style={{ color: '#4A4438' }}>(PDF or Word · max 5MB)</span></label>
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: '#1A1710', border: `1px solid ${cvFile ? '#E8A020' : '#2E2A22'}`,
                          borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s',
                        }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#E8A020' }}>↑</span>
                          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: cvFile ? '#D4CFC3' : '#3A3830' }}>
                            {cvFile ? cvFile.name : 'Choose file…'}
                          </span>
                          {cvFile && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', marginLeft: 'auto' }}>
                              {(cvFile.size / 1024).toFixed(0)}KB
                            </span>
                          )}
                          <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                            onChange={e => { setCvFile(e.target.files?.[0] || null); setAppError(''); }} />
                        </label>
                        {cvFile && (
                          <button onClick={() => setCvFile(null)}
                            style={{ alignSelf: 'flex-start', marginTop: 4, background: 'none', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', cursor: 'pointer', padding: 0, letterSpacing: '0.06em' }}>
                            ✕ Remove
                          </button>
                        )}
                      </div>

                      <div className="cr-field">
                        <label className="cr-label">Cover Letter *</label>
                        <textarea className="cr-input cr-textarea"
                          placeholder={`Why do you want to work at Ascentor? What makes you the right person for this role? Be specific — we read every word.`}
                          value={appForm.cover_letter} onChange={e => setField('cover_letter', e.target.value)} />
                      </div>

                      {appError && <div className="cr-app-error">{appError}</div>}

                      <div className="cr-form-actions">
                        <button
                          onClick={() => submitApplication(job)}
                          disabled={submitting}
                          className="cr-apply-btn"
                          style={{ opacity: submitting ? 0.7 : 1 }}
                        >
                          {submitting ? (cvUploading ? 'Uploading CV...' : 'Submitting...') : 'Submit Application →'}
                        </button>
                        <button className="cr-cancel-btn" onClick={() => setApplyingTo(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ paddingTop: 8 }}>
                      <button className="cr-apply-btn" onClick={() => openApply(job.id)}>
                        Apply for this role →
                      </button>
                    </div>
                  )}
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
