'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ROLES = [
  'GRC Analyst', 'Risk Analyst', 'Compliance Analyst',
  'Information Security Analyst', 'Junior GRC Consultant',
  'Risk & Compliance Analyst', 'GRC Associate',
  'Governance Analyst', 'Information Security Compliance Analyst',
];

const REGIONS = [
  { value: 'global',     label: 'Global (all regions)' },
  { value: 'USA',        label: 'United States' },
  { value: 'UK',         label: 'United Kingdom' },
  { value: 'Europe',     label: 'Europe' },
  { value: 'Canada',     label: 'Canada' },
  { value: 'Australia',  label: 'Australia' },
  { value: 'Nigeria',    label: 'Nigeria (multinationals)' },
  { value: 'Africa',     label: 'Africa (multinationals)' },
];

const COMPANY_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  global_remote:        { label: 'Global Remote',  color: '#60A5FA', bg: 'rgba(59,130,246,0.12)'  },
  africa_multinational: { label: 'African MNC',    color: '#E8A020', bg: 'rgba(232,160,32,0.12)'  },
  nigeria_based:        { label: 'Nigeria-based',  color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
};

const LEVEL_META: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
  entry:      { label: 'Entry Level',  color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)',  desc: '0–3 years · Junior / Analyst / Associate' },
  mid:        { label: 'Mid Level',    color: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)',  desc: '3–6 years · Specialist / Consultant' },
  senior:     { label: 'Senior',       color: '#E8A020', bg: 'rgba(232,160,32,0.10)',  border: 'rgba(232,160,32,0.25)',  desc: '6–10 years · Sr. Analyst / Sr. Consultant' },
  management: { label: 'Management',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.25)', desc: '8+ years · Manager / Director / Head of / CISO' },
};

const SOURCE_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn', greenhouse: 'Greenhouse', lever: 'Lever',
  ashby: 'Ashby', dice: 'Dice', indeed: 'Indeed',
  isaca: 'ISACA Jobs', 'infosec-jobs': 'InfoSec Jobs',
  company_site: 'Company Site', other: 'Other',
};

function FreshnessBar({ hoursOld }: { hoursOld?: number }) {
  if (hoursOld == null) return null;
  const pct   = Math.max(0, Math.min(100, 100 - (hoursOld / 48) * 100));
  const color = hoursOld <= 6  ? '#10B981'
               : hoursOld <= 24 ? '#E8A020'
               : '#EF4444';
  const label = hoursOld === 0  ? 'Just posted'
               : hoursOld < 1   ? '< 1 hour ago'
               : hoursOld === 1  ? '1 hour ago'
               : hoursOld < 24  ? `${hoursOld}h ago`
               : hoursOld < 48  ? `${Math.round(hoursOld / 24)}d ago`
               : '2+ days old';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

export default function GuardsmannJobs() {
  const [role,      setRole]      = useState('GRC Analyst');
  const [region,    setRegion]    = useState('global');
  const [keywords,  setKeywords]  = useState('');
  const [freshOnly, setFreshOnly] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [jobs,      setJobs]      = useState<any[]>([]);
  const [sources,   setSources]   = useState<Record<string, number>>({});
  const [searched,  setSearched]  = useState(false);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [savedIds,  setSavedIds]  = useState<Set<number>>(new Set());
  const [byLevel,   setByLevel]   = useState<Record<string, number>>({});
  const [levelFilter,setLevelFilter] = useState<'all' | 'entry' | 'mid' | 'senior' | 'management'>('all');

  const supabase = createClient();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function search() {
    setLoading(true);
    setSearched(false);
    try {
      const res  = await fetch('/api/guardsmann/jobs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role, region, keywords, freshOnly }),
      });
      const data = await res.json();
      if (data.jobs !== undefined) {
        setJobs(data.jobs);
        setSources(data.sources || {});
        setByLevel(data.byLevel || {});
        setSearched(true);
        setSavedIds(new Set());
        setLevelFilter('all');
        // Auto-push if fresh jobs found
        if (data.jobs.length > 0 && freshOnly) {
          const roles = [...new Set(data.jobs.map((j: any) => j.title as string))];
          fetch('/api/guardsmann/notify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'jobs_found', count: data.jobs.length, roles, topJob: data.jobs[0] }),
          }).catch(() => {}); // fire and forget
        }
      } else {
        showToast(data.error || 'Search failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    }
    setLoading(false);
  }

  async function saveJob(job: any, idx: number) {
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
      notes:                 `Posted: ${job.postedAt || 'unknown'} | Source: ${job.source || 'unknown'}`,
    });
    if (!error) {
      setSavedIds(prev => new Set([...prev, idx]));
      showToast(`Saved: ${job.title} at ${job.company}`);
    } else {
      showToast('Error: ' + error.message, false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F3EE', marginBottom: 4 }}>GRC Job Search</h1>
        <p style={{ fontSize: 12, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>
          3 sources searched in parallel · Fresh jobs only · Beat the queue
        </p>
      </div>

      {/* Search controls */}
      <div className="gm-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label className="gm-label">Role</label>
            <select className="gm-select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="gm-label">Region</label>
            <select className="gm-select" value={region} onChange={e => setRegion(e.target.value)}>
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="gm-label">Keywords (optional)</label>
            <input className="gm-input" placeholder="ISO 27001 · NIST · SOC 2 · fintech · healthcare…"
              value={keywords} onChange={e => setKeywords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()} />
          </div>
        </div>

        {/* Fresh toggle + active filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Fresh toggle */}
            <button
              onClick={() => setFreshOnly(f => !f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
                background: freshOnly ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${freshOnly ? 'rgba(16,185,129,0.35)' : 'var(--gm-border)'}`,
                color: freshOnly ? '#10B981' : 'var(--gm-muted)',
                fontFamily: 'var(--gm-font-mono)', fontSize: 11, fontWeight: 600,
                transition: 'all 0.15s',
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: freshOnly ? '#10B981' : 'var(--gm-muted)' }} />
              {freshOnly ? '⏱ FRESH ONLY — last 48h' : '📅 ALL JOBS — no date limit'}
            </button>
            {freshOnly && (
              <span style={{ fontSize: 11, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>
                Showing jobs from the last 48 hours only — toggle off to see all available roles
              </span>
            )}
          </div>
          <button className="gm-btn-primary" onClick={search} disabled={loading}>
            {loading ? 'Gathering all GRC jobs…' : '🔍 Search Now'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 12, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
            SEARCHING 3 SOURCES IN PARALLEL…
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            {['LinkedIn / Greenhouse / Lever', 'African Multinationals', 'ISACA / InfoSec-Jobs / Dice'].map(s => (
              <span key={s} style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)',
                padding: '4px 10px', borderRadius: 6, border: '1px solid var(--gm-border)', background: 'var(--gm-card)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source breakdown */}
      {searched && !loading && Object.keys(sources).length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'global', label: 'LinkedIn/Greenhouse/Lever', color: '#60A5FA' },
            { key: 'africa', label: 'African Multinationals',    color: '#E8A020' },
            { key: 'niche',  label: 'ISACA/InfoSec-Jobs/Dice',   color: '#8B5CF6' },
          ].map(s => (
            <div key={s.key} style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--gm-card)',
              border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
              <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 11, fontWeight: 700, color: s.color }}>
                {sources[s.key] ?? 0}
              </span>
            </div>
          ))}
          <div style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'var(--gm-font-mono)', fontSize: 11, color: '#10B981', fontWeight: 700 }}>
            {jobs.length} fresh jobs showing
          </div>
        </div>
      )}

      {/* Level filter tabs */}
      {searched && jobs.length > 0 && !loading && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
            FILTER BY LEVEL
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setLevelFilter('all')}
              style={{ padding: '7px 16px', borderRadius: 9, cursor: 'pointer',
                background: levelFilter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${levelFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--gm-border)'}`,
                color: levelFilter === 'all' ? '#F5F3EE' : 'var(--gm-muted)',
                fontFamily: 'var(--gm-font-mono)', fontSize: 11 }}>
              All ({jobs.length})
            </button>
            {(['entry', 'mid', 'senior', 'management'] as const).map(lvl => {
              const m   = LEVEL_META[lvl];
              const cnt = byLevel[lvl] || 0;
              if (cnt === 0) return null;
              return (
                <button key={lvl} onClick={() => setLevelFilter(lvl)}
                  style={{ padding: '7px 16px', borderRadius: 9, cursor: 'pointer',
                    background: levelFilter === lvl ? m.bg : 'transparent',
                    border: `1px solid ${levelFilter === lvl ? m.border : 'var(--gm-border)'}`,
                    color: levelFilter === lvl ? m.color : 'var(--gm-muted)',
                    fontFamily: 'var(--gm-font-mono)', fontSize: 11, fontWeight: levelFilter === lvl ? 700 : 400,
                    transition: 'all 0.15s' }}>
                  {m.label} ({cnt})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {searched && jobs.length === 0 && !loading && (
        <div className="gm-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, color: 'var(--gm-text)', marginBottom: 8 }}>No fresh jobs found right now</div>
          <div style={{ fontSize: 12, color: 'var(--gm-muted)', marginBottom: 20 }}>
            {freshOnly
              ? 'No GRC jobs found matching your filters. Try a different role or region.'
              : 'No matching jobs found. Try a different role or region.'}
          </div>
          {freshOnly && (
            <button className="gm-btn-secondary" onClick={() => { setFreshOnly(false); search(); }}>
              Show all jobs (remove 48h filter)
            </button>
          )}
        </div>
      )}

      {/* Job cards — grouped by level */}
      {(['entry', 'mid', 'senior', 'management'] as const).map(lvl => {
        const visibleJobs = jobs
          .map((j, i) => ({ ...j, _idx: i }))
          .filter(j => (levelFilter === 'all' || j.jobLevel === lvl) && (levelFilter !== 'all' || j.jobLevel === lvl));
        if (visibleJobs.length === 0 || (levelFilter !== 'all' && levelFilter !== lvl)) return null;
        const m = LEVEL_META[lvl];
        return (
          <div key={lvl} style={{ marginBottom: 8 }}>
            {levelFilter === 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, fontWeight: 700,
                  color: m.color, letterSpacing: '0.08em' }}>{m.label.toUpperCase()}</div>
                <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: 'var(--gm-muted)' }}>{m.desc}</div>
                <div style={{ flex: 1, height: 1, background: m.border }} />
                <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: m.color }}>{visibleJobs.length} role{visibleJobs.length !== 1 ? 's' : ''}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visibleJobs.map((job) => {
                const i     = job._idx;
                const ct    = COMPANY_TYPE_STYLE[job.companyType] || COMPANY_TYPE_STYLE.global_remote;
                const saved = savedIds.has(i);
                const lm    = LEVEL_META[job.jobLevel] || LEVEL_META.entry;

          return (
            <div key={i} className="gm-card" style={{ borderLeft: `3px solid ${ct.color}` }}>
              {/* Freshness bar */}
              <div style={{ marginBottom: 12 }}>
                <FreshnessBar hoursOld={job.hoursOld} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F3EE', marginBottom: 3 }}>{job.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--gm-text)' }}>{job.company}{job.hq ? ` · ${job.hq}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noreferrer"
                      className="gm-btn-primary" style={{ fontSize: 12, padding: '7px 16px', textDecoration: 'none', display: 'inline-block' }}>
                      Apply Now →
                    </a>
                  )}
                  <button
                    className="gm-btn-secondary"
                    style={{ fontSize: 11, padding: '6px 14px', color: saved ? '#10B981' : 'var(--gm-gold)', borderColor: saved ? 'rgba(16,185,129,0.4)' : undefined }}
                    onClick={() => !saved && saveJob(job, i)}
                    disabled={saved}>
                    {saved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, padding: '2px 8px', borderRadius: 999,
                  background: lm.bg, color: lm.color, border: `1px solid ${lm.border}`, fontWeight: 700 }}>
                  {lm.label}
                </span>
                <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, padding: '2px 8px', borderRadius: 999,
                  background: ct.bg, color: ct.color, border: `1px solid ${ct.color}30` }}>
                  {ct.label}
                </span>
                {job.salary && (
                  <span className="gm-badge gm-badge-gold">{job.salary}</span>
                )}
                {job.remote && <span className="gm-badge gm-badge-green">Remote</span>}
                {job.openToInternational && <span className="gm-badge gm-badge-green">Open to International</span>}
                {job.experienceRequired && <span className="gm-badge gm-badge-blue">{job.experienceRequired}</span>}
                {job.source && SOURCE_LABEL[job.source] && (
                  <span className="gm-badge gm-badge-grey">{SOURCE_LABEL[job.source]}</span>
                )}
              </div>

              {/* Requirements */}
              {job.requirements?.length > 0 && (
                <ul style={{ paddingLeft: 16, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {job.requirements.slice(0, 4).map((r: string, ri: number) => (
                    <li key={ri} style={{ fontSize: 12, color: 'var(--gm-text)' }}>{r}</li>
                  ))}
                </ul>
              )}

              {/* Fit note */}
              {job.fitNote && (
                <div style={{ padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', fontSize: 12, color: 'var(--gm-text)' }}>
                  <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: '#10B981', marginRight: 6 }}>FIT</span>
                  {job.fitNote}
                </div>
              )}
            </div>
          );
            })}
            </div>
          </div>
        );
      })}

      {toast && <div className={`gm-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>}
    </div>
  );
}
