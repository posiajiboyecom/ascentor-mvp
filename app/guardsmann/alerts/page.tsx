'use client';

import { useState } from 'react';

// ── Pre-built alert configurations ────────────────────────────────────────
// Each generates a ready-to-use URL or step-by-step setup instruction

const GRC_ROLES = [
  'GRC Analyst', 'Risk Analyst', 'Compliance Analyst',
  'Information Security Analyst', 'Junior GRC Consultant',
  'Risk & Compliance Analyst', 'GRC Associate',
];

const TARGET_COMPANIES = [
  // Big 4 + consulting
  { name: 'Deloitte',   careersUrl: 'https://apply.deloitte.com/careers/SearchJobs',         region: 'Global' },
  { name: 'PwC',        careersUrl: 'https://www.pwc.com/gx/en/careers/job-search.html',     region: 'Global' },
  { name: 'KPMG',       careersUrl: 'https://home.kpmg/xx/en/home/careers.html',             region: 'Global' },
  { name: 'EY',         careersUrl: 'https://careers.ey.com/ey/search/',                     region: 'Global' },
  { name: 'Accenture',  careersUrl: 'https://www.accenture.com/us-en/careers/jobsearch',     region: 'Global' },
  { name: 'IBM',        careersUrl: 'https://www.ibm.com/employment/',                       region: 'Global' },
  // Nigerian multinationals
  { name: 'MTN Nigeria',          careersUrl: 'https://www.mtn.com.ng/careers/',             region: 'Nigeria' },
  { name: 'Access Bank',          careersUrl: 'https://www.accessbankplc.com/careers',       region: 'Nigeria' },
  { name: 'Stanbic IBTC',         careersUrl: 'https://www.stanbicibtc.com/about-us/careers',region: 'Nigeria' },
  { name: 'Standard Chartered NG',careersUrl: 'https://www.sc.com/en/careers/',              region: 'Nigeria' },
  { name: 'Shell Nigeria',        careersUrl: 'https://www.shell.com.ng/careers.html',       region: 'Nigeria' },
  { name: 'TotalEnergies Nigeria',careersUrl: 'https://careers.totalenergies.com/',          region: 'Nigeria' },
  // Tech
  { name: 'Microsoft',    careersUrl: 'https://jobs.microsoft.com/',                         region: 'Global' },
  { name: 'Google',       careersUrl: 'https://careers.google.com/',                         region: 'Global' },
  { name: 'Flutterwave',  careersUrl: 'https://flutterwave.com/us/careers',                  region: 'Africa' },
  { name: 'Andela',       careersUrl: 'https://andela.com/company/careers/',                 region: 'Africa' },
];

const NICHE_BOARDS = [
  { name: 'ISACA Job Board',     url: 'https://jobs.isaca.org/',              desc: 'GRC-specific. ISACA-member employers. Often posts before LinkedIn.' },
  { name: 'InfoSec-Jobs',        url: 'https://infosec-jobs.com/',            desc: 'Cybersecurity and GRC only. Lower volume = lower competition.' },
  { name: 'CyberSecJobs',        url: 'https://www.cybersecjobs.com/',        desc: 'Cyber-focused. Many entry-level GRC roles posted here first.' },
  { name: 'Wellfound',           url: 'https://wellfound.com/jobs',           desc: 'Tech-company GRC roles. Startup + scale-up. Remote-first culture.' },
  { name: 'Dice',                url: 'https://www.dice.com/',                desc: 'Tech jobs with strong compliance/GRC filter. Good US coverage.' },
  { name: 'CyberSN',             url: 'https://www.cybersn.com/',             desc: 'Cybersecurity specialist recruiter + job board. High-quality GRC.' },
  { name: 'LinkedIn Jobs',       url: 'https://www.linkedin.com/jobs/',       desc: 'Largest volume. Set alerts for immediate email notification.' },
  { name: 'Greenhouse Job Board',url: 'https://boards.greenhouse.io/',        desc: 'Many tech companies post GRC roles here before LinkedIn.' },
  { name: 'Lever Job Board',     url: 'https://jobs.lever.co/',               desc: 'Same as Greenhouse — search by GRC role directly on the board.' },
];

// ── Google Alert URL builder ──────────────────────────────────────────────
function buildGoogleAlertUrl(query: string): string {
  const q = encodeURIComponent(`"${query}" remote "entry level" (site:linkedin.com/jobs OR site:greenhouse.io OR site:lever.co)`);
  return `https://www.google.com/alerts?q=${q}`;
}

// ── LinkedIn saved search URL builder ────────────────────────────────────
function buildLinkedInSearchUrl(role: string): string {
  const q     = encodeURIComponent(role);
  const today = 'r86400'; // last 24 hours
  return `https://www.linkedin.com/jobs/search/?keywords=${q}&f_WT=2&f_E=1%2C2&f_TPR=${today}&sortBy=DD`;
  // f_WT=2 = remote, f_E=1,2 = entry+associate, sortBy=DD = date descending
}

// ── Visualping setup URL ─────────────────────────────────────────────────
function buildVisualpingUrl(targetUrl: string): string {
  return `https://visualping.io/?url=${encodeURIComponent(targetUrl)}`;
}

export default function GuardsmannAlerts() {
  const [copied,       setCopied]       = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<'all' | 'Global' | 'Nigeria' | 'Africa'>('all');
  const [activeTab,    setActiveTab]    = useState<'google' | 'linkedin' | 'companies' | 'boards' | 'checklist'>('checklist');

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const filteredCompanies = regionFilter === 'all'
    ? TARGET_COMPANIES
    : TARGET_COMPANIES.filter(c => c.region === regionFilter);

  const tabStyle = (t: string) => ({
    padding: '8px 16px', borderRadius: '9px 9px 0 0', cursor: 'pointer' as const,
    background: activeTab === t ? 'var(--gm-card)' : 'transparent',
    border: activeTab === t ? '1px solid var(--gm-border)' : '1px solid transparent',
    borderBottom: activeTab === t ? '1px solid var(--gm-card)' : '1px solid var(--gm-border)',
    color: activeTab === t ? 'var(--gm-gold)' : 'var(--gm-muted)',
    fontFamily: 'var(--gm-font-mono)', fontSize: 11, fontWeight: 600,
    marginBottom: -1,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F3EE', marginBottom: 4 }}>Alerts & Monitoring</h1>
        <p style={{ fontSize: 12, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)' }}>
          Set up once · Get notified within hours of a fresh GRC posting · Beat the queue every time
        </p>
      </div>

      {/* Why speed matters banner */}
      <div className="gm-card" style={{ marginBottom: 24, borderLeft: '3px solid #EF4444', display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>⏱</div>
        <div>
          <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: '#EF4444', letterSpacing: '0.08em', marginBottom: 4 }}>
            THE WINDOW IS 24 HOURS
          </div>
          <div style={{ fontSize: 13, color: 'var(--gm-text)', lineHeight: 1.6 }}>
            A GRC Analyst role at a multinational gets <strong style={{ color: '#F5F3EE' }}>200–500 applications</strong> within 48 hours of posting.
            By Day 3, the recruiter has stopped looking. These alerts get you there in <strong style={{ color: '#F5F3EE' }}>hours, not days</strong>.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 0, borderBottom: '1px solid var(--gm-border)' }}>
        {[
          { key: 'checklist', label: '✅ Setup Checklist' },
          { key: 'google',    label: '🔔 Google Alerts' },
          { key: 'linkedin',  label: 'in LinkedIn Alerts' },
          { key: 'companies', label: '🏢 Company Pages' },
          { key: 'boards',    label: '📋 Niche Job Boards' },
        ].map(t => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key as any)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="gm-card" style={{ borderRadius: '0 12px 12px 12px', marginTop: 0 }}>

        {/* ── CHECKLIST TAB ─────────────────────────────────────────────── */}
        {activeTab === 'checklist' && (
          <div>
            <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 20 }}>
              COMPLETE SETUP — DO THIS ONCE, GET ALERTS FOREVER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                {
                  step: '1', done: false, time: '5 min',
                  title: 'Set up Google Alerts for 3 GRC roles',
                  detail: 'Creates email alerts that fire within hours of a new posting. Click the Google Alerts tab above to get your pre-built alert URLs.',
                  urgency: 'high',
                },
                {
                  step: '2', done: false, time: '5 min',
                  title: 'Save LinkedIn job searches with daily alerts',
                  detail: 'Search for your role on LinkedIn, filter by Remote + Entry Level + Past 24 hours, then click "Set alert." LinkedIn will email you daily with new matches.',
                  urgency: 'high',
                },
                {
                  step: '3', done: false, time: '10 min',
                  title: 'Set Visualping monitors on 5 target company career pages',
                  detail: 'Visualping watches a webpage and alerts you when it changes — meaning when a new job appears. Go to the Company Pages tab, pick your 5 top targets, and set up monitors.',
                  urgency: 'high',
                },
                {
                  step: '4', done: false, time: '3 min',
                  title: 'Create a free Wellfound account and set job alerts',
                  detail: 'Wellfound (formerly AngelList) is strong for tech-company GRC roles. Much smaller applicant pool than LinkedIn. Set alerts for "GRC" and "Compliance" remote.',
                  urgency: 'medium',
                },
                {
                  step: '5', done: false, time: '5 min',
                  title: 'Register on ISACA Job Board and enable alerts',
                  detail: 'You are already an ISACA member — use that. The ISACA job board posts GRC roles from member organisations, often before LinkedIn. Create a candidate profile and set role alerts.',
                  urgency: 'high',
                },
                {
                  step: '6', done: false, time: '3 min',
                  title: 'Set Indeed alerts for same-day postings',
                  detail: 'Go to Indeed → search "GRC Analyst remote" → click "Get new jobs for this search by email" → set frequency to daily. Indeed often indexes roles within hours.',
                  urgency: 'medium',
                },
                {
                  step: '7', done: false, time: '5 min',
                  title: 'Enable LinkedIn Open to Work (recruiters only)',
                  detail: 'Go to LinkedIn profile → Add profile section → Looking for job opportunities → set role, location (remote), and visibility to "Recruiters only." This makes you appear in recruiter searches without showing "Open to Work" publicly.',
                  urgency: 'high',
                },
                {
                  step: '8', done: false, time: '2 min',
                  title: 'Bookmark the Guardsmann Job Search page',
                  detail: 'Run a manual Guardsmann Job Search every morning. 3 sources searched in parallel in 30 seconds. Any fresh posting you find here, apply within the hour.',
                  urgency: 'medium',
                },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid var(--gm-border)' }}>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: item.urgency === 'high' ? 'rgba(16,185,129,0.15)' : 'rgba(232,160,32,0.12)',
                    border: `1px solid ${item.urgency === 'high' ? 'rgba(16,185,129,0.3)' : 'rgba(232,160,32,0.25)'}`,
                    color: item.urgency === 'high' ? '#10B981' : '#E8A020',
                    fontFamily: 'var(--gm-font-mono)', fontSize: 12, fontWeight: 700 }}>
                    {item.step}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F3EE' }}>{item.title}</span>
                      <span style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: 'var(--gm-muted)' }}>{item.time}</span>
                      {item.urgency === 'high' && (
                        <span className="gm-badge gm-badge-green" style={{ fontSize: 8 }}>DO FIRST</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gm-muted)', lineHeight: 1.6 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GOOGLE ALERTS TAB ─────────────────────────────────────────── */}
        {activeTab === 'google' && (
          <div>
            <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
              PRE-BUILT GOOGLE ALERT QUERIES — CLICK TO CREATE, THEN SET TO DAILY EMAIL
            </div>
            <div style={{ fontSize: 12, color: 'var(--gm-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Each link opens Google Alerts with the query pre-filled. Set frequency to "As it happens" for the fastest alerts.
              Google indexes job boards within hours of posting — often faster than LinkedIn's own email alerts.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {GRC_ROLES.map((role, i) => {
                const query    = `"${role}" remote "entry level" (site:linkedin.com OR site:greenhouse.io OR site:lever.co OR site:ashbyhq.com)`;
                const alertUrl = buildGoogleAlertUrl(role);
                return (
                  <div key={i} style={{ padding: '14px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid var(--gm-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F3EE', marginBottom: 4 }}>{role}</div>
                      <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                        {query}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button className="gm-btn-secondary" style={{ fontSize: 11, padding: '5px 12px' }}
                        onClick={() => copy(query, `q-${i}`)}>
                        {copied === `q-${i}` ? '✓' : 'Copy Query'}
                      </button>
                      <a href={alertUrl} target="_blank" rel="noreferrer"
                        className="gm-btn-primary" style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none', display: 'inline-block' }}>
                        Create Alert →
                      </a>
                    </div>
                  </div>
                );
              })}

              {/* Additional power queries */}
              <div style={{ marginTop: 8, fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>
                POWER QUERIES — for wider coverage
              </div>
              {[
                { label: 'Nigeria multinationals GRC', q: '"GRC" OR "compliance analyst" OR "risk analyst" Lagos OR Nigeria "multinational" hiring' },
                { label: 'ISACA job board new posts',   q: 'site:jobs.isaca.org GRC analyst' },
                { label: 'Remote GRC today',            q: '"GRC analyst" OR "compliance analyst" remote "today" OR "hours ago" -senior -manager -director' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F3EE', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)' }}>{item.q}</div>
                  </div>
                  <button className="gm-btn-secondary" style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }}
                    onClick={() => copy(item.q, `pq-${i}`)}>
                    {copied === `pq-${i}` ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LINKEDIN ALERTS TAB ───────────────────────────────────────── */}
        {activeTab === 'linkedin' && (
          <div>
            <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
              LINKEDIN SAVED SEARCHES — DAILY EMAIL ALERTS
            </div>
            <div style={{ fontSize: 12, color: 'var(--gm-muted)', marginBottom: 8, lineHeight: 1.6 }}>
              Each link opens a pre-filtered LinkedIn Jobs search. Click "Set alert" on the search results page to get daily emails.
              Filters applied: <strong style={{ color: '#F5F3EE' }}>Remote · Entry Level · Past 24 hours · Sorted by date</strong>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(96,165,250,0.06)',
              border: '1px solid rgba(96,165,250,0.2)', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: '#60A5FA', marginBottom: 6 }}>
                ALSO DO THIS ON YOUR LINKEDIN PROFILE
              </div>
              <div style={{ fontSize: 12, color: 'var(--gm-text)', lineHeight: 1.7 }}>
                Go to your profile → <strong>Open to work</strong> → Add role preferences → select GRC Analyst, Risk Analyst, Compliance Analyst
                → set location as <strong>Remote</strong> → set visibility to <strong>"Recruiters only"</strong> (not public).
                This makes you appear in recruiter searches without the green "Open to Work" banner on your photo.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {GRC_ROLES.map((role, i) => {
                const url = buildLinkedInSearchUrl(role);
                return (
                  <div key={i} style={{ padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid var(--gm-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F3EE', marginBottom: 3 }}>{role}</div>
                      <div style={{ fontSize: 11, color: 'var(--gm-muted)' }}>
                        Remote · Entry Level · Past 24h · Sorted by newest
                      </div>
                    </div>
                    <a href={url} target="_blank" rel="noreferrer"
                      className="gm-btn-primary" style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none', display: 'inline-block', flexShrink: 0 }}>
                      Open + Set Alert →
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COMPANY PAGES TAB ─────────────────────────────────────────── */}
        {activeTab === 'companies' && (
          <div>
            <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
              MONITOR COMPANY CAREER PAGES — ALERTS BEFORE LINKEDIN PICKS UP THE JOB
            </div>
            <div style={{ fontSize: 12, color: 'var(--gm-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Companies post on their own careers page <strong style={{ color: '#F5F3EE' }}>12–48 hours before LinkedIn</strong>.
              Use <a href="https://visualping.io" target="_blank" rel="noreferrer" style={{ color: '#E8A020' }}>Visualping</a> or{' '}
              <a href="https://distill.io" target="_blank" rel="noreferrer" style={{ color: '#E8A020' }}>Distill.io</a> (both free tiers available)
              to watch the careers page and email you when it changes. Set check frequency to every 6 hours.
            </div>

            {/* Region filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['all', 'Global', 'Nigeria', 'Africa'] as const).map(r => (
                <button key={r} onClick={() => setRegionFilter(r)}
                  style={{ padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                    background: regionFilter === r ? 'rgba(232,160,32,0.12)' : 'transparent',
                    border: `1px solid ${regionFilter === r ? 'rgba(232,160,32,0.4)' : 'var(--gm-border)'}`,
                    color: regionFilter === r ? 'var(--gm-gold)' : 'var(--gm-muted)',
                    fontFamily: 'var(--gm-font-mono)', fontSize: 11 }}>
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {filteredCompanies.map((co, i) => {
                const vpUrl = buildVisualpingUrl(co.careersUrl);
                return (
                  <div key={i} style={{ padding: '14px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid var(--gm-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F3EE', marginBottom: 2 }}>{co.name}</div>
                        <span className={`gm-badge ${co.region === 'Nigeria' ? 'gm-badge-green' : co.region === 'Africa' ? 'gm-badge-gold' : 'gm-badge-blue'}`}
                          style={{ fontSize: 8 }}>{co.region}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <a href={co.careersUrl} target="_blank" rel="noreferrer"
                        className="gm-btn-secondary" style={{ fontSize: 10, padding: '4px 10px', textDecoration: 'none', display: 'inline-block' }}>
                        Careers Page →
                      </a>
                      <a href={vpUrl} target="_blank" rel="noreferrer"
                        className="gm-btn-secondary" style={{ fontSize: 10, padding: '4px 10px', textDecoration: 'none', display: 'inline-block', color: '#E8A020', borderColor: 'rgba(232,160,32,0.3)' }}>
                        Monitor with Visualping →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── NICHE BOARDS TAB ──────────────────────────────────────────── */}
        {activeTab === 'boards' && (
          <div>
            <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 8 }}>
              NICHE GRC JOB BOARDS — LOWER VOLUME, LOWER COMPETITION
            </div>
            <div style={{ fontSize: 12, color: 'var(--gm-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              These boards have <strong style={{ color: '#F5F3EE' }}>far fewer applicants</strong> than LinkedIn for the same role.
              A GRC Analyst post on InfoSec-Jobs might get 20 applications vs 400 on LinkedIn. Register on all of them and set job alerts.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {NICHE_BOARDS.map((board, i) => (
                <div key={i} style={{ padding: '16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid var(--gm-border)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F3EE', marginBottom: 4 }}>{board.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gm-muted)', lineHeight: 1.6 }}>{board.desc}</div>
                  </div>
                  <a href={board.url} target="_blank" rel="noreferrer"
                    className="gm-btn-primary" style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none', display: 'inline-block', flexShrink: 0 }}>
                    Visit →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
