'use client';

// app/admin/inbox/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin inbox — shows all contact_messages rows.
// Features: filter by status, expand to read full message, update status,
// one-click mailto reply. Styled in The Ledger admin design system.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const B = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.10)',
  goldBorder:  'rgba(232,160,32,0.25)',
  text:        'var(--admin-text)',
  heading:     'var(--admin-text-heading)',
  muted:       'var(--admin-text-muted)',
  faint:       'var(--admin-text-faint)',
  card:        'var(--admin-bg-deep)',
  cardAlt:     'var(--admin-bg-card)',
  border:      'var(--admin-border)',
  error:       '#EF4444',
  new:         '#8B5CF6',
  read:        '#6B7280',
  replied:     '#10B981',
  archived:    '#374151',
};

type Status = 'new' | 'read' | 'replied' | 'archived';
type Msg = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

const SUBJECT_LABELS: Record<string, string> = {
  general:     'General inquiry',
  partnership: 'Partnership opportunity',
  speaking:    'Speaking / Summit',
  media:       'Media / Press',
  support:     'Platform support',
  other:       'Something else',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:      { label: 'New',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)'  },
  read:     { label: 'Read',     color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
  replied:  { label: 'Replied',  color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)'  },
  archived: { label: 'Archived', color: '#374151', bg: 'rgba(55,65,81,0.1)',    border: 'rgba(55,65,81,0.25)'   },
};

function MonoLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: B.fontMono, fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: color || B.faint }}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.read;
  return (
    <span style={{
      fontFamily: B.fontMono, fontSize: '9px', fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
      padding: '2px 8px', borderRadius: '999px',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

type StatusFilter = 'all' | 'new' | 'read' | 'replied' | 'archived';

export default function AdminInboxPage() {
  const [messages, setMessages]   = useState<Msg[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<StatusFilter>('all');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [updating, setUpdating]   = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setMessages(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    const { error } = await supabase
      .from('contact_messages')
      .update({ status: newStatus })
      .eq('id', id);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    }
    setUpdating(null);
  }

  // When expanding a 'new' message, mark it read automatically
  function handleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const msg = messages.find(m => m.id === id);
    if (msg?.status === 'new') updateStatus(id, 'read');
  }

  const filtered = filter === 'all' ? messages : messages.filter(m => m.status === filter);
  const counts   = { all: messages.length, new: 0, read: 0, replied: 0, archived: 0 };
  for (const m of messages) { if (counts[m.status as StatusFilter] !== undefined) counts[m.status as StatusFilter]++; }

  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all',      label: `All (${counts.all})`         },
    { id: 'new',      label: `New (${counts.new})`         },
    { id: 'read',     label: `Read (${counts.read})`       },
    { id: 'replied',  label: `Replied (${counts.replied})` },
    { id: 'archived', label: `Archived (${counts.archived})`},
  ];

  return (
    <div style={{ fontFamily: B.fontUI }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '12px', marginBottom: '6px' }}>
          <div>
            <h1 style={{ fontFamily: B.fontDisplay, fontWeight: 700, fontSize: 'clamp(22px, 3vw, 30px)', color: B.heading, margin: 0, lineHeight: 1.15 }}>
              Inbox
            </h1>
            <p style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted, marginTop: '6px', letterSpacing: '0.04em' }}>
              {loading ? 'LOADING…' : `${counts.new} NEW · ${counts.all} TOTAL`}
            </p>
          </div>
          {counts.new > 0 && (
            <span style={{
              fontFamily: B.fontMono, fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              padding: '6px 14px', borderRadius: '999px',
              background: 'rgba(139,92,246,0.1)', color: '#8B5CF6',
              border: '1px solid rgba(139,92,246,0.3)',
            }}>
              {counts.new} unread
            </span>
          )}
        </div>
        <div style={{ height: '1px', background: `linear-gradient(90deg, ${B.gold} 0%, transparent 60%)`, marginTop: '16px' }} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '10px', background: B.cardAlt, marginBottom: '20px', overflowX: 'auto' as const }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{
              flex: '1 1 0', minWidth: '60px', padding: '8px 6px',
              borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontFamily: B.fontUI, fontSize: '11px', fontWeight: 600,
              whiteSpace: 'nowrap' as const,
              background: filter === f.id ? B.card : 'transparent',
              color: filter === f.id ? B.gold : B.muted,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}><MonoLabel>Loading messages…</MonoLabel></div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <MonoLabel>{filter === 'all' ? 'No messages yet.' : `No ${filter} messages.`}</MonoLabel>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(msg => {
            const isOpen   = expanded === msg.id;
            const subLabel = SUBJECT_LABELS[msg.subject] || msg.subject;
            const isNew    = msg.status === 'new';

            return (
              <div key={msg.id} style={{
                borderRadius: '12px',
                background: B.card,
                border: `1px solid ${isNew ? 'rgba(139,92,246,0.3)' : B.border}`,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                {/* Row header — always visible */}
                <div
                  onClick={() => handleExpand(msg.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 18px', cursor: 'pointer',
                    flexWrap: 'wrap' as const,
                  }}
                >
                  {/* Unread dot */}
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                    background: isNew ? '#8B5CF6' : 'transparent',
                    border: isNew ? 'none' : `1.5px solid ${B.border}`,
                  }} />

                  {/* Name + subject */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' as const }}>
                      <span style={{ fontFamily: B.fontUI, fontSize: '13px', fontWeight: isNew ? 700 : 500, color: B.heading }}>
                        {msg.name}
                      </span>
                      <StatusPill status={msg.status} />
                    </div>
                    <span style={{ fontFamily: B.fontUI, fontSize: '12px', color: B.muted }}>{subLabel}</span>
                  </div>

                  {/* Date + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <MonoLabel>{formatDate(msg.created_at)}</MonoLabel>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', color: B.faint }}>
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${B.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as const }}>
                      {[
                        ['From',    msg.name],
                        ['Email',   msg.email],
                        ['Topic',   subLabel],
                        ['Received', new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p style={{ fontFamily: B.fontMono, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: B.faint, margin: '0 0 3px' }}>{k}</p>
                          <p style={{ fontFamily: B.fontUI, fontSize: '12px', color: B.text, margin: 0 }}>{v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Message body */}
                    <div style={{ background: B.cardAlt, borderRadius: '8px', border: `1px solid ${B.border}`, padding: '14px 16px' }}>
                      <p style={{ fontFamily: B.fontUI, fontSize: '13px', color: B.text, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' as const }}>
                        {msg.message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      {/* Reply mailto */}
                      <a
                        href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(subLabel)}`}
                        style={{
                          fontFamily: B.fontUI, fontSize: '12px', fontWeight: 600,
                          padding: '7px 14px', borderRadius: '7px', textDecoration: 'none',
                          background: B.gold, color: '#0C0B08',
                          display: 'inline-block',
                        }}
                      >
                        Reply via email
                      </a>

                      {/* Status actions */}
                      {(['new', 'read', 'replied', 'archived'] as const).filter(s => s !== msg.status).map(s => {
                        const cfg = STATUS_CONFIG[s];
                        return (
                          <button
                            key={s}
                            disabled={updating === msg.id}
                            onClick={() => updateStatus(msg.id, s)}
                            style={{
                              fontFamily: B.fontUI, fontSize: '11px', fontWeight: 600,
                              padding: '7px 12px', borderRadius: '7px', border: `1px solid ${cfg.border}`,
                              background: 'transparent', color: cfg.color,
                              cursor: updating === msg.id ? 'not-allowed' : 'pointer',
                              opacity: updating === msg.id ? 0.5 : 1,
                            }}
                          >
                            Mark as {cfg.label.toLowerCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
