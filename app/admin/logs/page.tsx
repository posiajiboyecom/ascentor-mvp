'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// FEATURE #1: Admin Audit Logs Page — /admin/logs
// Shows a filterable, searchable log of all platform actions.
// ============================================================

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  profiles?: { full_name: string; current_role: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  user_signup: 'var(--success, #10B981)',
  user_login: 'var(--blue, #60A5FA)',
  password_changed: 'var(--accent, #F59E0B)',
  login_blocked: 'var(--error, #EF4444)',
  profile_updated: 'var(--teal, #14B8A6)',
  content_created: 'var(--success, #10B981)',
  content_updated: 'var(--accent, #F59E0B)',
  content_deleted: 'var(--error, #EF4444)',
  newsletter_sent: 'var(--purple, #8B5CF6)',
  payment_success: 'var(--success, #10B981)',
  payment_failed: 'var(--error, #EF4444)',
  promo_activation: 'var(--accent, #F59E0B)',
  coaching_session_started: 'var(--blue, #60A5FA)',
  account_deleted: 'var(--error, #EF4444)',
  suspicious_login: 'var(--error, #EF4444)',
};

const ENTITY_TYPES = ['all', 'security', 'auth', 'profile', 'payment', 'content', 'community', 'coaching'];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const supabase = createClient();

  const fetchLogs = useCallback(async (pageNum: number, entityFilter: string, searchQuery: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(full_name, current_role)')
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      if (searchQuery) {
        query = query.or(`action.ilike.%${searchQuery}%,entity_id.ilike.%${searchQuery}%`);
      }

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

  useEffect(() => {
    fetchLogs(page, filter, search);
  }, [page, filter, search, fetchLogs]);

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card, #12151F)',
    border: '1px solid var(--border, #2A2D3A)',
    borderRadius: '12px',
    padding: '16px',
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border, #2A2D3A)',
    background: 'var(--bg-input, #1A1D2E)',
    color: 'var(--text, #F1F0EB)',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
        Audit Logs
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
        Track all actions across the platform. See who did what and when.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search actions, IDs..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ ...inputStyle, flex: '1', minWidth: '200px' }}
        />
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {ENTITY_TYPES.map(t => (
            <option key={t} value={t}>
              {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Log Entries */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit logs found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Time', 'User', 'Action', 'Type', 'Entity ID', 'Details', 'IP'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      color: 'var(--text-dim)',
                      fontWeight: 500,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>
                      {formatTime(log.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                      {log.profiles?.full_name || log.user_id?.slice(0, 8) || 'System'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: `${ACTION_COLORS[log.action] || 'var(--text-dim)'}15`,
                        color: ACTION_COLORS[log.action] || 'var(--text-dim)',
                      }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: ACTION_COLORS[log.action] || 'var(--text-dim)',
                        }} />
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {log.entity_type}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '11px' }}>
                      {log.entity_id ? log.entity_id.slice(0, 12) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details && Object.keys(log.details).length > 0
                        ? JSON.stringify(log.details).slice(0, 60)
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '11px' }}>
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          style={{
            ...inputStyle,
            cursor: page === 0 ? 'not-allowed' : 'pointer',
            opacity: page === 0 ? 0.4 : 1,
          }}
        >
          ← Previous
        </button>
        <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
          Page {page + 1}
        </span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasMore}
          style={{
            ...inputStyle,
            cursor: !hasMore ? 'not-allowed' : 'pointer',
            opacity: !hasMore ? 0.4 : 1,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
