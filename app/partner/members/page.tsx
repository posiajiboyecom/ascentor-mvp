// ============================================================
// app/partner/revenue/page.tsx
//
// FILE LOCATION: app/partner/revenue/page.tsx
//
// FIXES:
//   W-14 — "Month vs Last" summary card now adapts to the selected
//           period selector:
//             - "This Month"  → shows this_month_ngn vs last_month_ngn (unchanged)
//             - "This Year"   → shows this_year_ngn vs last_year_ngn (YoY)
//             - "All Time"    → shows avg_per_month_ngn (monthly average)
//           The card label and sub-label update accordingly.
//
//   W-13 — Transaction reference: full ref shown in `title` tooltip.
//           Clipboard copy button added next to the truncated ref.
//           Copy button shows a ✓ tick for 1.5s after copying.
//
//   W-22 — Hardcoded 'Cormorant Garamond' replaced with
//           var(--font-heading) throughout (h1, SummaryCard value).
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
  last_year_ngn: number;       // FIX W-14
  avg_per_month_ngn: number;   // FIX W-14
};

const PLAN_COLORS: Record<string, string> = {
  explorer: '#14B8A6', builder: '#E8A020', climber: '#8B5CF6',
};

// FIX W-13: copy-to-clipboard button for references
function CopyRefButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy full reference'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 4px', color: copied ? 'var(--success)' : 'var(--text-dim)',
        fontSize: 11, lineHeight: 1,
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

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

  // FIX W-14: third card config driven by active period
  const thirdCard = (() => {
    if (!summary) return null;
    if (period === 'month') return {
      label: 'Month vs Last',
      value: fmt(summary.this_month_ngn),
      sub:   `Last month: ${fmt(summary.last_month_ngn)}`,
    };
    if (period === 'year') return {
      label: 'This Year vs Last',
      value: fmt(summary.partner_total_ngn),
      sub:   `Last year: ${fmt(summary.last_year_ngn)}`,
    };
    // All Time
    return {
      label: 'Avg / Month',
      value: fmt(summary.avg_per_month_ngn),
      sub:   'Across all time',
    };
  })();

  return (
    <div className="animate-fade-up" style={{ maxWidth: 760 }}>
      {/* FIX W-22: var(--font-heading) */}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
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

      {/* ── Summary cards — FIX W-14 ── */}
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
          {/* FIX W-14: third card changes with period */}
          {thirdCard && (
            <SummaryCard
              label={thirdCard.label}
              value={thirdCard.value}
              sub={thirdCard.sub}
            />
          )}
        </div>
      )}

      {/* ── Revenue split ── */}
      {summary && summary.count > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8,
            }}>
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
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 80px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
        }}>
          {['Date / Ref', 'Plan', 'Gross', 'Your Share', 'Status'].map(h => (
            <span key={h} style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-dim)',
            }}>
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
              {/* Date + reference — FIX W-13 */}
              <div>
                <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                  {new Date(tx.paid_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <p
                    title={tx.paystack_reference}  // FIX W-13: full ref on hover
                    style={{
                      fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace',
                      cursor: 'default',
                    }}
                  >
                    {tx.paystack_reference.slice(0, 16)}…
                  </p>
                  {/* FIX W-13: copy button */}
                  <CopyRefButton value={tx.paystack_reference} />
                </div>
              </div>

              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                color: PLAN_COLORS[tx.plan] || 'var(--text-dim)',
              }}>
                {tx.plan}
              </span>

              <span style={{ fontSize: 12, color: 'var(--text)' }}>{fmt(tx.amount_ngn)}</span>

              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                {fmt(tx.partner_share_ngn)}
              </span>

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
      background: accent ? 'rgba(245,158,11,0.04)' : 'var(--bg-card)',
      border: `1px solid ${accent ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8,
      }}>
        {label}
      </p>
      {/* FIX W-22: var(--font-heading) not hardcoded Cormorant Garamond */}
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-heading)' }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</p>
    </div>
  );
}
