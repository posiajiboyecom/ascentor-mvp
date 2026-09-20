'use client';

// /admin/summit-payments
// The ONE place to manage Elevation Summit money. Summit tickets only:
// subscriptions live on /admin/payments and are never mixed in here.
//
// Single source of truth: summit_registrations. A ticket counts as PAID only if
// payment_status = 'paid'. Each paid row shows whether Paystack recorded a
// transaction id for it, so a row that is not backed by a real payment is obvious.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCw, X, Trash2, Copy, ShieldCheck, Mail, Phone, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePageSearch } from '@/components/shell/PageSearch';
import { confirmAction } from '@/components/Modal';

type PayState = 'paid' | 'in_progress' | 'abandoned' | 'not_started';

interface Reg {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string | null;
  location: string | null;
  organisation: string | null;
  current_role: string | null;
  attendance_type: 'onsite' | 'virtual' | null;
  payment_state: PayState;
  attempt_count: number;
  amount_paid: number | string | null;
  paystack_fee?: number | string | null;
  paid_at: string | null;
  payment_reference: string | null;
  payment_provider_tx_id: string | null;
  confirmation_email_sent_at?: string | null;
  confirmation_email_error?: string | null;
  created_at: string;
  source: string | null;
}

const STATE: Record<PayState, { label: string; bg: string; fg: string }> = {
  paid:        { label: 'Paid',                 bg: 'rgba(34,160,90,.15)',  fg: '#177245' },
  in_progress: { label: 'Paying now',           bg: 'rgba(60,120,220,.15)', fg: '#2453A6' },
  abandoned:   { label: 'Left at payment',      bg: 'rgba(220,60,60,.13)',  fg: '#A32626' },
  not_started: { label: 'Registered, not paid', bg: 'rgba(200,169,110,.22)', fg: '#8A6A1F' },
};

type Tab = 'paid' | 'unpaid' | 'all';

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
// Paystack local fee: 1.5% (+₦100 from ₦2,500), capped ₦2,000. Used only when the real fee was not stored.
const estFee = (a: number) => (a ? Math.min(a * 0.015 + (a >= 2500 ? 100 : 0), 2000) : 0);
const feeOf = (r: Reg) => (r.paystack_fee != null ? num(r.paystack_fee) : estFee(num(r.amount_paid)));
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const waLink = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, '')}`;

export default function SummitPaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const query = usePageSearch('Search name, email, phone…');
  const [regs, setRegs] = useState<Reg[]>([]);
  const [tab, setTab] = useState<Tab>('paid');
  const [type, setType] = useState<'all' | 'onsite' | 'virtual'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [open, setOpen] = useState<Reg | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string | null>(null);

  const authed = useCallback(async (input: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init.headers ?? {}) },
    });
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authed('/api/admin/summit-registrations');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load Summit registrations');
      const list: Reg[] = body.registrations ?? [];
      setRegs(list);
      setOpen(prev => (prev ? list.find(r => r.id === prev.id) ?? null : null));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authed]);

  useEffect(() => { load(); }, [load]);

  const paid = useMemo(() => regs.filter(r => r.payment_state === 'paid'), [regs]);
  const unpaid = useMemo(() => regs.filter(r => r.payment_state !== 'paid'), [regs]);

  const stats = useMemo(() => {
    const gross = paid.reduce((t, r) => t + num(r.amount_paid), 0);
    const fees = paid.reduce((t, r) => t + feeOf(r), 0);
    const physical = paid.filter(r => r.attendance_type !== 'virtual').length;
    const virtual = paid.length - physical;
    const unverified = paid.filter(r => !r.payment_provider_tx_id).length;
    return { gross, fees, net: gross - fees, physical, virtual, unverified };
  }, [paid]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === 'paid' ? paid : tab === 'unpaid' ? unpaid : regs)
      .filter(r => type === 'all' || (r.attendance_type ?? 'onsite') === type)
      .filter(r => !q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.whatsapp ?? '').includes(q));
  }, [tab, paid, unpaid, regs, type, query]);

  const reconcile = async () => {
    setRunning(true); setNote(null);
    try {
      const res = await fetch('/api/admin/payments', { method: 'POST' });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Reconciliation failed');
      setNote(`Checked ${b.checked}. ${b.recovered} recovered, ${b.adopted ?? 0} older Paystack payments adopted, ${b.emailsRetried ?? 0} emails retried.`);
      await load();
    } catch (e) { setNote((e as Error).message); }
    setRunning(false);
  };

  const act = async (action: 'verify' | 'resend') => {
    if (!open) return;
    setBusy(true); setPanelMsg(null);
    const res = await authed('/api/admin/summit-registrations', { method: 'POST', body: JSON.stringify({ id: open.id, action }) });
    const b = await res.json().catch(() => ({}));
    setPanelMsg(b.message || b.error || (res.ok ? 'Done.' : 'Action failed.'));
    setBusy(false);
    if (res.ok && action === 'verify') await load();
  };

  const remove = async () => {
    if (!open) return;
    const isPaid = open.payment_state === 'paid';
    const yes = await confirmAction(
      isPaid
        ? `Delete the PAID registration of ${open.full_name} (${naira(num(open.amount_paid))})? This permanently removes it and its revenue. Only do this for test data.`
        : `Delete the registration of ${open.full_name}? Only do this for test data.`,
      { confirmLabel: 'Delete permanently', danger: true },
    );
    if (!yes) return;
    setBusy(true);
    const res = await fetch('/api/admin/payments', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'summit_registration', id: open.id }),
    });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setPanelMsg(b.error || 'Delete failed'); return; }
    setOpen(null); setNote(`${open.full_name} deleted. Totals updated.`);
    await load();
  };

  const cell: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };
  const lab: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)', margin: '0 0 3px' };
  const val: React.CSSProperties = { fontSize: 13.5, color: 'var(--ledger-ink)', margin: 0, wordBreak: 'break-word' };

  const Card = ({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: string }) => (
    <div className="rounded-xl ledger-panel" style={{ padding: '12px 14px', borderTop: `3px solid ${accent ?? 'var(--ledger-line)'}` }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ledger-ink)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ledger-ink-soft)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <p className="ledger-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0, color: '#8A6A1F' }}>The Elevation Summit · 19 Nov 2026</p>
          <h1 className="ledger-h1" style={{ fontSize: 26, margin: '2px 0 0' }}>Summit Payments</h1>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>Tickets only. Subscription payments are on a separate page.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ledger-btn ledger-btn-ghost" onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="ledger-btn ledger-btn-primary" onClick={reconcile} disabled={running} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Ask Paystack about every unfinished Summit payment and confirm any that were actually paid">
            <RotateCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Checking Paystack…' : 'Check Paystack now'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Card title="Paid tickets" value={String(paid.length)} sub={`${stats.physical} physical · ${stats.virtual} virtual`} accent="#177245" />
        <Card title="Gross revenue" value={naira(stats.gross)} sub="what customers paid" accent="#C8A96E" />
        <Card title="Paystack fees" value={naira(stats.fees)} sub={regs.some(r => r.paystack_fee != null) ? 'real + estimated' : 'estimated'} accent="#A32626" />
        <Card title="Net revenue" value={naira(stats.net)} sub="after Paystack fees" accent="#177245" />
        <Card title="Not paid yet" value={String(unpaid.length)} sub={`${unpaid.filter(r => r.payment_state === 'abandoned').length} left at payment`} accent="#8A6A1F" />
      </div>

      {stats.unverified > 0 && (
        <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>
          {stats.unverified} paid ticket{stats.unverified === 1 ? ' has' : 's have'} no Paystack transaction id. That means it was not confirmed by a real payment. Open it to check.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {([['paid', `Paid (${paid.length})`], ['unpaid', `Not paid (${unpaid.length})`], ['all', `Everyone (${regs.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}
            className={`ledger-btn ${tab === k ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}>{l}</button>
        ))}
        <span style={{ width: 8 }} />
        {([['all', 'Physical + Virtual'], ['onsite', 'Physical'], ['virtual', 'Virtual']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
            className={`ledger-btn ${type === k ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}>{l}</button>
        ))}
      </div>

      {note && <p className="ledger-mono" style={{ fontSize: 12, marginBottom: 10 }}>{note}</p>}
      {error && <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>{error}</div>}

      <div className="rounded-xl ledger-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ledger-ink-soft)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)' }}>Person</th>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 110 }}>Ticket</th>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 150 }}>Status</th>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 110 }}>{tab === 'paid' ? 'Paid' : 'Registered'}</th>
            </tr>
          </thead>
          <tbody>
            {loading && regs.length === 0 ? (
              <tr><td colSpan={4} className="ledger-mono" style={{ padding: 28, textAlign: 'center' }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="ledger-mono" style={{ padding: 28, textAlign: 'center' }}>Nobody here.</td></tr>
            ) : rows.map(r => {
              const st = STATE[r.payment_state];
              return (
                <tr key={r.id} onClick={() => { setOpen(r); setPanelMsg(null); }} className="hover:bg-black/5"
                  style={{ borderTop: '1px solid var(--ledger-line)', cursor: 'pointer' }}>
                  <td style={{ ...cell, overflow: 'hidden' }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}{r.whatsapp ? ` · ${r.whatsapp}` : ''}</div>
                  </td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600, color: 'var(--ledger-ink)' }}>{r.payment_state === 'paid' ? naira(num(r.amount_paid)) : '-'}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5 }}>{r.attendance_type === 'virtual' ? 'Virtual' : 'Physical'}</div>
                  </td>
                  <td style={cell}>
                    <span style={{ background: st.bg, color: st.fg, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                    {r.payment_state === 'paid' && !r.payment_provider_tx_id && (
                      <div style={{ color: 'var(--ledger-bad)', fontSize: 10.5, marginTop: 3 }}>no Paystack id</div>
                    )}
                  </td>
                  <td style={{ ...cell, color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(tab === 'paid' ? r.paid_at : r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} aria-hidden />}
      <aside role="dialog" aria-label="Registration details" aria-hidden={!open}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', zIndex: 61,
          background: 'var(--ledger-panel, #fff)', borderLeft: '1px solid var(--ledger-line)', boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
          overflowY: 'auto', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .25s ease', padding: 20,
        }}>
        {open && (() => {
          const st = STATE[open.payment_state];
          const isPaid = open.payment_state === 'paid';
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="ledger-h1" style={{ fontSize: 18, margin: 0 }}>{open.full_name}</h2>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="ledger-btn ledger-btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
              </div>
              {panelMsg && <p className="ledger-mono" style={{ fontSize: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--ledger-gold-bg)', margin: '0 0 14px' }}>{panelMsg}</p>}

              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ background: st.bg, color: st.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                  {isPaid && <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ledger-ink)' }}>{naira(num(open.amount_paid))}</span>}
                </div>

                <div><p style={lab}>Email</p><p style={val}>{open.email}</p></div>
                <div>
                  <p style={lab}>Phone</p>
                  {open.whatsapp ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <p style={val}>{open.whatsapp}</p>
                      <a href={`tel:${open.whatsapp}`} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 9px' }}><Phone size={13} /> Call</a>
                      <a href={waLink(open.whatsapp)} target="_blank" rel="noopener noreferrer" className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 9px' }}><MessageCircle size={13} /> WhatsApp</a>
                    </div>
                  ) : <p style={{ ...val, color: 'var(--ledger-bad)' }}>not captured</p>}
                </div>
                <div><p style={lab}>Ticket</p><p style={val}>{open.attendance_type === 'virtual' ? 'Virtual' : 'Physical (Onsite, Lagos)'}</p></div>
                <div><p style={lab}>Company / role</p><p style={val}>{[open.organisation, open.current_role].filter(Boolean).join(' · ') || '-'}</p></div>
                <div><p style={lab}>Location</p><p style={val}>{open.location || '-'}</p></div>
                <div><p style={lab}>Registered</p><p style={val}>{when(open.created_at)} · via {open.source ?? 'web'}</p></div>

                {isPaid ? (
                  <>
                    <div><p style={lab}>Paid</p><p style={val}>{when(open.paid_at)}</p></div>
                    <div><p style={lab}>Paystack fee</p><p style={val}>{naira(feeOf(open))}{open.paystack_fee == null ? ' (estimated)' : ''} · net {naira(num(open.amount_paid) - feeOf(open))}</p></div>
                    <div>
                      <p style={lab}>Paystack transaction</p>
                      <p style={{ ...val, color: open.payment_provider_tx_id ? undefined : 'var(--ledger-bad)' }}>
                        {open.payment_provider_tx_id ? `#${open.payment_provider_tx_id}` : 'None recorded. Not confirmed by a real payment.'}
                      </p>
                    </div>
                    <div>
                      <p style={lab}>Confirmation email + ticket</p>
                      <p style={val}>
                        {open.confirmation_email_sent_at ? `Sent ${when(open.confirmation_email_sent_at)}`
                          : open.confirmation_email_error ? `FAILED: ${open.confirmation_email_error}`
                          : 'No delivery record. Send it again if the customer did not get it.'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div><p style={lab}>Payment attempts</p><p style={val}>{open.attempt_count === 0 ? 'Never reached the payment step.' : `${open.attempt_count} started, none completed.`}</p></div>
                )}

                {open.payment_reference && (
                  <div>
                    <p style={lab}>Reference</p>
                    <p style={{ ...val, fontFamily: 'var(--ledger-font-mono, monospace)', fontSize: 12 }}>
                      {open.payment_reference}{' '}
                      <button type="button" aria-label="Copy reference" onClick={() => navigator.clipboard?.writeText(open.payment_reference!)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ledger-ink-soft)', verticalAlign: 'middle' }}><Copy size={13} /></button>
                    </p>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                  {isPaid ? (
                    <button type="button" disabled={busy} onClick={() => act('resend')} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={14} /> {busy ? 'Sending…' : 'Send confirmation email + ticket'}
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => act('verify')} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={14} /> {busy ? 'Checking…' : 'Check Paystack for this person'}
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={remove} className="ledger-btn ledger-btn-ghost"
                    style={{ color: 'var(--ledger-bad)', display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={14} /> Delete (test data)
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </aside>
    </div>
  );
}
