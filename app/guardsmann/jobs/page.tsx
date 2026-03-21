'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ROLES = [
  'GRC Analyst',
  'Risk Analyst',
  'Compliance Analyst',
  'Information Security Analyst',
  'Junior GRC Consultant',
  'Risk & Compliance Analyst',
  'GRC Associate',
  'Governance Analyst',
  'Information Security Compliance Analyst',
];

const REGIONS = [
  { value: 'global',            label: 'Global (all regions)' },
  { value: 'USA',               label: 'United States' },
  { value: 'UK',                label: 'United Kingdom' },
  { value: 'Europe',            label: 'Europe' },
  { value: 'Canada',            label: 'Canada' },
  { value: 'Australia',         label: 'Australia' },
  { value: 'Nigeria',           label: 'Nigeria (multinationals only)' },
  { value: 'Africa',            label: 'Africa (multinationals only)' },
];

const COMPANY_TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  global_remote:       { label: 'Global Remote', cls: 'gm-badge-blue'  },
  africa_multinational:{ label: 'African MNC',   cls: 'gm-badge-gold'  },
  nigeria_based:       { label: 'Nigeria-based',  cls: 'gm-badge-green' },
};

export default function GuardsmannJobs() {
  const [role,     setRole]     = useState('GRC Analyst');
  const [region,   setRegion]   = useState('global');
  const [keywords, setKeywords] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [jobs,     setJobs]     = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [raw,      setRaw]      = useState('');
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function search() {
    setLoading(true);
    setSearched(false);
    setRaw('');
    try {
      const res  = await fetch('/api/guardsmann/jobs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role, region, keywords }),
      });
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
        setRaw(data.raw || '');
        setSearched(true);
      } else {
        showToast(data.error || 'Search failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    }
    setLoading(false);
  }

  async function saveJob(job: any) {
    const { error } = await supabase.from('guardsmann_jobs').insert({
      company:               job.company,
      hq:                    job.hq,
      title:                 job.title,
      salary:                job.salary,
      url:                   job.url,
      requirements:          job.requirements,
      fit_note:              job.fitNote,
      open_to_international: job.openToInternational,
      experience_required:   job.experienceRequired,
      status:                'saved',
    });
    if (!error) showToast(`Saved: ${job.title} at ${job.company}`);
    else showToast('Error saving: ' + error.message, false);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F3EE', marginBottom: 4 }}>GRC Job Search</h1>
        <p style={{ fontSize: 12, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>
          Entry-level · Remote · Open to international · USD pay · Global companies only
        </p>
      </div>

      {/* Search controls */}
      <div className="gm-card" style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 14 }}>
          SEARCH PARAMETERS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label className="gm-label">Role</label>
            <select className="gm-select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="gm-label">Company Region</label>
            <select className="gm-select" value={region} onChange={e => setRegion(e.target.value)}>
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="gm-label">Additional Keywords (optional)</label>
            <input className="gm-input" placeholder="e.g. ISO 27001, NIST, SOC 2, fintech, healthcare…"
              value={keywords} onChange={e => setKeywords(e.target.value)} />
          </div>
        </div>

        {/* Filters reminder */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['Remote · or Nigeria/Africa MNC', 'Open to Nigerian applicants', '0-3 years experience', 'USD or USD-equivalent', 'Global + African multinationals'].map(f => (
            <span key={f} className="gm-badge gm-badge-green">{f}</span>
          ))}
        </div>

        <button className="gm-btn-primary" onClick={search} disabled={loading}>
          {loading ? 'Searching… (takes 20-30s)' : '🔍 Search Jobs'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 12, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
            SEARCHING GLOBAL JOB BOARDS…
          </div>
          <div style={{ fontSize: 12, color: 'var(--gm-muted)' }}>
            Filtering for remote · international · entry-level · USD · global companies
          </div>
        </div>
      )}

      {/* No results */}
      {searched && jobs.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gm-muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>No matching jobs found this search</div>
          <div style={{ fontSize: 12, fontFamily: 'var(--gm-font-mono)' }}>Try a different role or region — the market changes daily</div>
          {raw && (
            <details style={{ marginTop: 20, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--gm-gold)' }}>Show raw search output</summary>
              <pre style={{ fontSize: 11, color: 'var(--gm-muted)', marginTop: 10, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{raw}</pre>
            </details>
          )}
        </div>
      )}

      {/* Job cards */}
      {jobs.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)', marginBottom: 12, letterSpacing: '0.06em' }}>
            {jobs.length} ROLES FOUND — SAVE ONES YOU WANT TO APPLY TO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {jobs.map((job, i) => (
              <div key={i} className="gm-card" style={{ borderLeft: '3px solid #10B981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F3EE', marginBottom: 4 }}>
                      {job.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gm-text)', marginBottom: 8 }}>
                      {job.company} · {job.hq}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {job.salary && <span className="gm-badge gm-badge-gold">{job.salary}</span>}
                      {job.remote && <span className="gm-badge gm-badge-green">Remote</span>}
                      {job.openToInternational && <span className="gm-badge gm-badge-green">Open to International</span>}
                      {job.companyType && COMPANY_TYPE_LABEL[job.companyType] && (
                        <span className={`gm-badge ${COMPANY_TYPE_LABEL[job.companyType].cls}`}>
                          {COMPANY_TYPE_LABEL[job.companyType].label}
                        </span>
                      )}
                      {job.experienceRequired && <span className="gm-badge gm-badge-blue">{job.experienceRequired}</span>}
                      {job.postedRecently && <span className="gm-badge gm-badge-grey">{job.postedRecently}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noreferrer"
                        className="gm-btn-secondary" style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none', display: 'inline-block' }}>
                        Apply →
                      </a>
                    )}
                    <button className="gm-btn-secondary" style={{ fontSize: 11, padding: '6px 14px', color: 'var(--gm-gold)' }}
                      onClick={() => saveJob(job)}>
                      Save
                    </button>
                  </div>
                </div>

                {job.requirements?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: 'var(--gm-muted)', letterSpacing: '0.06em', marginBottom: 6 }}>KEY REQUIREMENTS</div>
                    <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {job.requirements.slice(0, 4).map((r: string, ri: number) => (
                        <li key={ri} style={{ fontSize: 12, color: 'var(--gm-text)' }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {job.fitNote && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: '#10B981', marginRight: 6 }}>FIT NOTE</span>
                    <span style={{ fontSize: 12, color: 'var(--gm-text)' }}>{job.fitNote}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {toast && <div className={`gm-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>}
    </div>
  );
}
