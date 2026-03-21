'use client';

import { useState } from 'react';

const REGIONS = [
  { value: 'global',   label: 'Global' },
  { value: 'USA',      label: 'United States' },
  { value: 'UK',       label: 'United Kingdom' },
  { value: 'Europe',   label: 'Europe' },
  { value: 'Nigeria',  label: 'Nigeria / Africa' },
];

const POSI_DM = `Hi [Name],

I came across your profile and noticed you recruit in the GRC and compliance space.

I'm a GRC professional with hands-on experience in ISO 27001, risk assessment, compliance, and audit preparation. CompTIA Security+, Google Cybersecurity Professional, and ISACA member.

Actively seeking remote entry-level GRC roles — open to global opportunities.

Happy to share my CV if you have relevant mandates. Would a quick conversation make sense?

Best,
Posi`;

export default function GuardsmannRecruiters() {
  const [mode,    setMode]    = useState<'recruiters' | 'agencies'>('recruiters');
  const [region,  setRegion]  = useState('global');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [copied,  setCopied]  = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
    showToast('Copied to clipboard');
  }

  async function search() {
    setLoading(true);
    setSearched(false);
    try {
      const res  = await fetch('/api/guardsmann/recruiters', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode, region }),
      });
      const data = await res.json();
      if (data.results !== undefined) {
        setResults(data.results);
        setSearched(true);
      } else {
        showToast(data.error || 'Search failed', false);
      }
    } catch (e: any) {
      showToast(e.message, false);
    }
    setLoading(false);
  }

  function priorityColor(score: number): string {
    if (score >= 8) return '#10B981';
    if (score >= 5) return '#E8A020';
    return '#6B6456';
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F3EE', marginBottom: 4 }}>Recruiter Finder</h1>
        <p style={{ fontSize: 12, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>
          Bypass the application queue — contact GRC recruiters before jobs are posted publicly
        </p>
      </div>

      {/* Why this works */}
      <div className="gm-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--gm-gold)' }}>
        <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 10 }}>
          WHY THIS BEATS JOB BOARDS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {[
            { n: '1', title: 'Before the queue', body: 'Recruiters with active GRC mandates often place candidates before the role is publicly posted. You reach them when they have zero applicants.' },
            { n: '2', title: 'Warm pipeline',    body: 'A recruiter who has your CV keeps you in mind for future roles. One contact = multiple opportunities over months.' },
            { n: '3', title: 'Direct line',      body: 'A 2-sentence DM to the right recruiter beats 50 cold applications every time. They are paid to place you.' },
          ].map(({ n, title, body }) => (
            <div key={n}>
              <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', marginBottom: 4 }}>{n}. {title.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: 'var(--gm-muted)', lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="gm-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {(['recruiters', 'agencies'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                padding: '8px 20px', borderRadius: 9, cursor: 'pointer',
                background: mode === m ? 'rgba(232,160,32,0.12)' : 'transparent',
                border: `1px solid ${mode === m ? 'rgba(232,160,32,0.4)' : 'var(--gm-border)'}`,
                color: mode === m ? 'var(--gm-gold)' : 'var(--gm-muted)',
                fontFamily: 'var(--gm-font-mono)', fontSize: 11, fontWeight: 600,
              }}>
              {m === 'recruiters' ? '👤 Individual Recruiters' : '🏢 Agencies & Firms'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="gm-label">Region Focus</label>
            <select className="gm-select" value={region} onChange={e => setRegion(e.target.value)}>
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="gm-btn-primary" onClick={search} disabled={loading} style={{ flexShrink: 0 }}>
            {loading ? 'Searching…' : mode === 'recruiters' ? '🔍 Find Recruiters' : '🔍 Find Agencies'}
          </button>
        </div>

        {mode === 'recruiters' && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 9,
            background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: '#60A5FA', marginBottom: 6 }}>
              YOUR DM TEMPLATE — copy and personalise for each recruiter
            </div>
            <pre style={{ fontSize: 12, color: 'var(--gm-text)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'var(--gm-font-ui)' }}>
              {POSI_DM}
            </pre>
            <button className="gm-btn-secondary" style={{ marginTop: 10, fontSize: 11, padding: '5px 12px' }}
              onClick={() => copyText(POSI_DM, 'base-dm')}>
              {copied === 'base-dm' ? '✓ Copied' : 'Copy Template'}
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 12, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
            {mode === 'recruiters' ? 'FINDING GRC RECRUITERS…' : 'FINDING GRC AGENCIES…'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gm-muted)' }}>Searching LinkedIn and agency databases for active mandates</div>
        </div>
      )}

      {/* No results */}
      {searched && results.length === 0 && !loading && (
        <div className="gm-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: 14, color: 'var(--gm-muted)', marginBottom: 6 }}>No results found for this region</div>
          <div style={{ fontSize: 12, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>Try "Global" for the widest results</div>
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {results.map((r, i) => {
          const score    = r.priorityScore || 0;
          const scoreCol = priorityColor(score);
          const dmId     = `dm-${i}`;

          return (
            <div key={i} className="gm-card" style={{ borderLeft: `3px solid ${scoreCol}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#F5F3EE' }}>
                      {mode === 'recruiters' ? r.name : r.agencyName}
                    </span>
                    {/* Priority score */}
                    <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 999,
                      background: `${scoreCol}18`, color: scoreCol, border: `1px solid ${scoreCol}30` }}>
                      Priority {score}/10
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gm-muted)' }}>
                    {mode === 'recruiters'
                      ? `${r.title || ''} ${r.company ? `· ${r.company}` : ''}`
                      : r.specialisation || ''}
                  </div>
                </div>

                {/* Action button */}
                {mode === 'recruiters' && r.linkedinUrl && (
                  <a href={r.linkedinUrl} target="_blank" rel="noreferrer"
                    className="gm-btn-primary" style={{ fontSize: 12, padding: '7px 16px', textDecoration: 'none', flexShrink: 0 }}>
                    View on LinkedIn →
                  </a>
                )}
                {mode === 'agencies' && r.website && (
                  <a href={r.website} target="_blank" rel="noreferrer"
                    className="gm-btn-primary" style={{ fontSize: 12, padding: '7px 16px', textDecoration: 'none', flexShrink: 0 }}>
                    Visit Agency →
                  </a>
                )}
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {(mode === 'recruiters' ? r.specialisation : r.specialisation) && (
                  <span className="gm-badge gm-badge-blue">{r.specialisation}</span>
                )}
                {(mode === 'recruiters' ? r.region : null) && (
                  <span className="gm-badge gm-badge-grey">{r.region}</span>
                )}
                {mode === 'agencies' && r.openToNigerianCandidates && (
                  <span className="gm-badge gm-badge-green">Open to Nigerian Candidates</span>
                )}
                {(mode === 'recruiters' ? r.activeRoles : r.typicalRoles)?.slice(0, 3).map((role: string, ri: number) => (
                  <span key={ri} className="gm-badge gm-badge-grey">{role}</span>
                ))}
              </div>

              {/* Why contact / recent activity */}
              {(r.whyContact || r.whyThisAgency) && (
                <div style={{ fontSize: 12, color: 'var(--gm-text)', marginBottom: 12, lineHeight: 1.6 }}>
                  <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: 'var(--gm-gold)', marginRight: 6 }}>
                    {mode === 'recruiters' ? 'WHY CONTACT' : 'WHY THIS AGENCY'}
                  </span>
                  {r.whyContact || r.whyThisAgency}
                </div>
              )}

              {/* Recent activity for recruiters */}
              {mode === 'recruiters' && r.recentActivity && (
                <div style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(96,165,250,0.06)',
                  border: '1px solid rgba(96,165,250,0.15)', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: '#60A5FA', marginRight: 6 }}>RECENT ACTIVITY</span>
                  <span style={{ fontSize: 12, color: 'var(--gm-text)' }}>{r.recentActivity}</span>
                </div>
              )}

              {/* Agency submission process */}
              {mode === 'agencies' && r.submissionProcess && (
                <div style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: '#8B5CF6', marginRight: 6 }}>HOW TO APPLY</span>
                  <span style={{ fontSize: 12, color: 'var(--gm-text)' }}>{r.submissionProcess}</span>
                </div>
              )}

              {/* Personalised DM for recruiters */}
              {mode === 'recruiters' && r.dmTemplate && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)' }}>
                      PERSONALISED DM — ready to send
                    </span>
                    <button className="gm-btn-secondary"
                      style={{ fontSize: 10, padding: '4px 10px', color: copied === dmId ? '#10B981' : undefined,
                        borderColor: copied === dmId ? 'rgba(16,185,129,0.4)' : undefined }}
                      onClick={() => copyText(r.dmTemplate, dmId)}>
                      {copied === dmId ? '✓ Copied' : 'Copy DM'}
                    </button>
                  </div>
                  <pre style={{ fontSize: 12, color: 'var(--gm-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.7,
                    fontFamily: 'var(--gm-font-ui)', padding: '10px 14px', borderRadius: 9,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gm-border)' }}>
                    {r.dmTemplate}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && <div className={`gm-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>}
    </div>
  );
}
