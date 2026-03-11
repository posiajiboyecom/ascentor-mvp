// ============================================================
// app/partner/revenue/page.tsx
// Revenue dashboard — total earnings, transaction history,
// split breakdown per payment
// ============================================================

'use client';

import { useState, useEffect } from 'react';

type Transaction = {
  id: string;
  amount_ngn: number;
  partner_share_ngn: number;
  ascentor_fee_ngn: number;
  revenue_share_pct: number;
  plan: string;
  billing_cycle: string;
  paystack_reference: string;
  status: string;
  paid_at: string;
};

type Summary = {
  total_ngn: number;
  partner_total_ngn: number;
  ascentor_total_ngn: number;
  count: number;
  this_month_ngn: number;
  last_month_ngn: number;
};

const PLAN_COLORS: Record<string, string> = {
  explorer: '#14B8A6', builder: '#E8A020', climber: '#8B5CF6',
};

export default function RevenueAdminPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary]           = useState<Summary | null>(null);
  const [loading, setLoading]           = useState(true);
  const [period, setPeriod]             = useState<'all' | 'month' | 'year'>('month');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch(`/api/partner/revenue?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setSummary(data.summary);
      }
      setLoading(false);
    };
    load();
  }, [period]);

  const fmt = (n: number) => `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

  return (
    <div className="animate-fade-up" style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
        Revenue
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 28 }}>
        Your earnings from member subscriptions
      </p>

      {/* ── Period selector ── */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 10,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        marginBottom: 24, width: 'fit-content',
      }}>
        {([['month', 'This Month'], ['year', 'This Year'], ['all', 'All Time']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setPeriod(val)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: period === val ? 'var(--accent)' : 'transparent',
              color: period === val ? '#000' : 'var(--text-dim)',
              transition: 'all 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Summary cards ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          <SummaryCard
            label="Your Earnings"
            value={fmt(summary.partner_total_ngn)}
            sub={`${summary.count} payment${summary.count !== 1 ? 's' : ''}`}
            accent
          />
          <SummaryCard
            label="Gross Revenue"
            value={fmt(summary.total_ngn)}
            sub="Total collected"
          />
          <SummaryCard
            label="Month vs Last"
            value={fmt(summary.this_month_ngn)}
            sub={`Last month: ${fmt(summary.last_month_ngn)}`}
          />
        </div>
      )}

      {/* ── Revenue split explainer ── */}
      {summary && summary.count > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8 }}>
              Revenue Split
            </p>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'var(--accent)',
                width: `${summary.partner_total_ngn / summary.total_ngn * 100}%`,
                transition: 'width 0.5s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                You: {fmt(summary.partner_total_ngn)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Platform: {fmt(summary.ascentor_total_ngn)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction table ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 80px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
        }}>
          {['Date', 'Plan', 'Gross', 'Your Share', 'Status'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>◈</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              No transactions yet. Once members subscribe, payments will appear here.
            </p>
          </div>
        ) : (
          transactions.map((tx, i) => (
            <div key={tx.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 80px',
                padding: '12px 18px', alignItems: 'center',
                borderBottom: i < transactions.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
              {/* Date */}
              <div>
                <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                  {new Date(tx.paid_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                  {tx.paystack_reference.slice(0, 16)}...
                </p>
              </div>

              {/* Plan */}
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                color: PLAN_COLORS[tx.plan] || 'var(--text-dim)',
              }}>
                {tx.plan}
              </span>

              {/* Gross */}
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{fmt(tx.amount_ngn)}</span>

              {/* Partner share */}
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                {fmt(tx.partner_share_ngn)}
              </span>

              {/* Status */}
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                color: tx.status === 'completed' ? 'var(--success)' : 'var(--error)',
              }}>
                {tx.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${accent ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
      borderRadius: 12, padding: '16px 18px',
      background: accent ? 'rgba(245,158,11,0.04)' : 'var(--bg-card)',
    } as any}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)', fontFamily: "'Cormorant Garamond', serif" }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</p>
    </div>
  );
}
