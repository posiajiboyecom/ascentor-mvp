'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ASCENTOR BRAND TOKENS · Brand Book v1.0 · 2026
// Display : Cormorant Garamond 700 / Italic 600
// UI      : Syne 400–800
// Mono    : DM Mono 400/500
// Gold    : #E8A020   Dark: var(--admin-bg)
// ============================================================

const B = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  // Dark scale
  dark:        'var(--admin-bg)',
  dark900:     'var(--admin-bg)',
  dark800:     'var(--admin-bg-deep)',
  dark700:     'var(--admin-bg-card)',
  dark600:     'var(--admin-bg-input)',
  dark500:     'var(--admin-text-faint)',
  dark400:     'var(--admin-text-muted)',
  dark200:     'var(--admin-text)',
  dark50: 'var(--admin-text-heading)',
  // Gold scale
  gold:        '#E8A020',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.09)',
  goldBorder:  'rgba(232,160,32,0.22)',
  // Warm border
  border:      'var(--admin-border)',
  borderHover: 'var(--admin-border-strong)',
  // Stage colors (brand book pg 4)
  explorer:    '#14B8A6',  // Students 15–22
  builder:     '#E8A020',  // Early career 22–32
  climber:     '#8B5CF6',  // Mid-career 32–50
  // Semantic
  success:     '#10B981',
  error:       '#EF4444',
};

// ── Action colour map — only uses brand-palette colours ──────────
const ACTION_COLOR: Record<string, string> = {
  user_signup:              B.explorer,
  user_login:               B.climber,
  password_changed:         B.gold,
  login_blocked:            B.error,
  profile_updated:          B.explorer,
  content_created:          B.success,
  content_updated:          B.gold,
  content_deleted:          B.error,
  newsletter_sent:          B.climber,
  payment_success:          B.success,
  payment_failed:           B.error,
  promo_activation:         B.gold,
  coaching_session_started: B.climber,
  account_deleted:          B.error,
  suspicious_login:         B.error,
};

const ENTITY_TYPES = ['all', 'security', 'auth', 'profile', 'payment', 'content', 'community', 'coaching'];
const PAGE_SIZE    = 50;

interface AuditLog {
  id:          string;
  user_id:     string | null;
  action:      string;
  entity_type: string;
  entity_id:   string | null;
  details:     any;
  ip_address:  string | null;
  created_at:  string;
  profiles?:   { full_name: string; current_role: string } | null;
}

// ── Small reusable primitives ────────────────────────────────────
function MonoLabel({ children, color = B.dark500 }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily:    B.fontMono,
      fontSize:      '10px',
      fontWeight:    500,
      letterSpacing: '0.07em',
      textTransform: 'uppercase' as const,
      color,
    }}>
      {children}
    </span>
  );
}

function ActionPill({ action }: { action: string }) {
  const color = ACTION_COLOR[action] ?? B.dark400;
  const label = action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '5px',
      padding:       '3px 10px',
      borderRadius:  '999px',
      background:    `${color}12`,
      border:        `1px solid ${color}30`,
      fontFamily:    B.fontMono,
      fontSize:      '10px',
      fontWeight:    500,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color,
      whiteSpace:    'nowrap' as const,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export default function AdminAuditLogsPage() {
  const supabase = createClient();

  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (pageNum: number, entityFilter: string, searchQuery: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(full_name, current_role)')
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
      if (searchQuery)             query = query.or(`action.ilike.%${searchQuery}%,entity_id.ilike.%${searchQuery}%`);

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchLogs(page, filter, search); }, [page, filter, search, fetchLogs]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .asc-input {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid ${B.border};
          background: ${B.dark700};
          color: ${B.dark50};
          font-family: ${B.fontUI};
          font-size: 13px;
          font-weight: 400;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .asc-input::placeholder { color: ${B.dark500}; }
        .asc-input:focus        { border-color: ${B.goldBorder}; }

        .asc-select {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid ${B.border};
          background: ${B.dark700};
          color: ${B.dark200};
          font-family: ${B.fontMono};
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
          appearance: none;
          padding-right: 32px;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%234A4438' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }
        .asc-select:focus { border-color: ${B.goldBorder}; }

        .asc-log-row { transition: background 0.12s ease; }
        .asc-log-row:hover { background: rgba(232,160,32,0.03) !important; }

        .asc-page-btn {
          padding: 9px 20px;
          border-radius: 10px;
          border: 1px solid ${B.border};
          background: ${B.dark700};
          color: ${B.dark200};
          font-family: ${B.fontUI};
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s ease;
          letter-spacing: 0.01em;
        }
        .asc-page-btn:hover:not(:disabled) {
          border-color: ${B.goldBorder};
          color: ${B.gold};
        }
        .asc-page-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* Responsive table scroll */
        .asc-table-wrap { overflow-x: auto; }
        .asc-table { width: 100%; border-collapse: collapse; min-width: 780px; }

        /* Tab bar */
        .asc-tabs { display: flex; gap: 2px; padding: 4px; border-radius: 10px; background: ${B.dark700}; overflow-x: auto; }
        .asc-tab {
          flex-shrink: 0;
          padding: 7px 14px;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          font-family: ${B.fontMono};
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transition: all 0.12s ease;
          background: transparent;
          color: ${B.dark500};
        }
        .asc-tab.active {
          background: ${B.dark600};
          color: ${B.gold};
        }
      `}</style>

      <div className="animate-fade-up" style={{ fontFamily: B.fontUI }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontFamily: B.fontDisplay,
            fontWeight: 700,
            fontSize:   'clamp(24px, 3vw, 32px)',
            color:      B.dark50,
            margin:     '0 0 4px',
            lineHeight: 1.15,
          }}>
            Audit Logs
          </h1>
          <p style={{
            fontFamily: B.fontMono,
            fontSize:   '11px',
            color:      B.dark500,
            margin:     '0 0 0',
            letterSpacing: '0.04em',
          }}>
            TRACK ALL ACTIONS ACROSS THE PLATFORM · WHO DID WHAT · WHEN
          </p>

          {/* Gold rule */}
          <div style={{
            height:     '1px',
            background: `linear-gradient(90deg, ${B.gold} 0%, transparent 60%)`,
            marginTop:  '16px',
          }} />
        </div>

        {/* ── FILTERS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>

          {/* Search */}
          <input
            type="text"
            placeholder="Search actions, entity IDs…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="asc-input"
            style={{ width: '100%' }}
          />

          {/* Entity type tabs */}
          <div className="asc-tabs">
            {ENTITY_TYPES.map(t => (
              <button
                key={t}
                className={`asc-tab${filter === t ? ' active' : ''}`}
                onClick={() => { setFilter(t); setPage(0); }}
              >
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          borderRadius: '14px',
          overflow:     'hidden',
          background:   B.dark800,
          border:       `1px solid ${B.border}`,
          marginBottom: '16px',
        }}>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <MonoLabel color={B.dark500}>Loading logs…</MonoLabel>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{
                fontFamily: B.fontDisplay,
                fontSize:   '26px',
                color:      B.dark500,
                margin:     '0 0 8px',
              }}>
                No logs found
              </p>
              <MonoLabel color={B.dark600}>
                {search ? 'No results match your search.' : `No ${filter === 'all' ? '' : filter} entries yet.`}
              </MonoLabel>
            </div>
          ) : (
            <div className="asc-table-wrap">
              <table className="asc-table">

                {/* Table head — DM Mono labels, brand spec */}
                <thead>
                  <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                    {['Time', 'User', 'Action', 'Type', 'Entity ID', 'Details', 'IP'].map((h, i) => (
                      <th key={h} style={{
                        padding:       '12px 16px',
                        textAlign:     'left',
                        fontFamily:    B.fontMono,
                        fontSize:      '10px',
                        fontWeight:    500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                        color:         B.dark500,
                        whiteSpace:    'nowrap' as const,
                        background:    B.dark700,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Table body */}
                <tbody>
                  {logs.map((log, idx) => (
                    <tr
                      key={log.id}
                      className="asc-log-row"
                      style={{
                        borderBottom: idx < logs.length - 1 ? `1px solid ${B.border}` : 'none',
                        background:   'transparent',
                      }}
                    >
                      {/* Time — DM Mono */}
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' as const }}>
                        <span style={{
                          fontFamily:    B.fontMono,
                          fontSize:      '11px',
                          fontWeight:    400,
                          color:         B.dark400,
                          letterSpacing: '0.02em',
                        }}>
                          {formatTime(log.created_at)}
                        </span>
                      </td>

                      {/* User — Syne for name, Mono for ID fallback */}
                      <td style={{ padding: '13px 16px', minWidth: '140px' }}>
                        {log.profiles?.full_name ? (
                          <div>
                            <p style={{
                              fontFamily: B.fontUI,
                              fontSize:   '13px',
                              fontWeight: 500,
                              color:      B.dark50,
                              margin:     '0 0 2px',
                            }}>
                              {log.profiles.full_name}
                            </p>
                            <MonoLabel color={B.dark500}>{log.profiles.current_role}</MonoLabel>
                          </div>
                        ) : (
                          <span style={{
                            fontFamily:    B.fontMono,
                            fontSize:      '11px',
                            color:         B.dark500,
                            letterSpacing: '0.04em',
                          }}>
                            {log.user_id?.slice(0, 8) ?? 'SYSTEM'}
                          </span>
                        )}
                      </td>

                      {/* Action — brand pill */}
                      <td style={{ padding: '13px 16px' }}>
                        <ActionPill action={log.action} />
                      </td>

                      {/* Entity type — Mono tag */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          fontFamily:    B.fontMono,
                          fontSize:      '10px',
                          fontWeight:    500,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase' as const,
                          padding:       '2px 8px',
                          borderRadius:  '999px',
                          background:    B.dark700,
                          color:         B.dark400,
                          border:        `1px solid ${B.border}`,
                          whiteSpace:    'nowrap' as const,
                        }}>
                          {log.entity_type}
                        </span>
                      </td>

                      {/* Entity ID — DM Mono */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          fontFamily:    B.fontMono,
                          fontSize:      '11px',
                          fontWeight:    400,
                          color:         B.dark500,
                          letterSpacing: '0.03em',
                        }}>
                          {log.entity_id ? log.entity_id.slice(0, 12) + '…' : '—'}
                        </span>
                      </td>

                      {/* Details — truncated, Syne body */}
                      <td style={{
                        padding:      '13px 16px',
                        maxWidth:     '200px',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap' as const,
                      }}>
                        <span style={{
                          fontFamily: B.fontUI,
                          fontSize:   '12px',
                          color:      B.dark400,
                        }}>
                          {log.details && Object.keys(log.details).length > 0
                            ? JSON.stringify(log.details).slice(0, 55) + '…'
                            : '—'}
                        </span>
                      </td>

                      {/* IP — DM Mono */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          fontFamily:    B.fontMono,
                          fontSize:      '11px',
                          fontWeight:    400,
                          color:         B.dark500,
                          letterSpacing: '0.03em',
                        }}>
                          {log.ip_address ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PAGINATION ── */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          padding:        '4px 0',
        }}>
          <button
            className="asc-page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Previous
          </button>

          <span style={{
            fontFamily:    B.fontMono,
            fontSize:      '10px',
            fontWeight:    500,
            letterSpacing: '0.07em',
            textTransform: 'uppercase' as const,
            color:         B.dark500,
          }}>
            Page {page + 1}
          </span>

          <button
            className="asc-page-btn"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
          >
            Next →
          </button>
        </div>

      </div>
    </>
  );
}
