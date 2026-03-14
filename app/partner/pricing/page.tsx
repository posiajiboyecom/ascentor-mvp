// app/partner/pricing/page.tsx
//
// IMPROVED: Added NGN price fields per plan, currency selector, NGN rate override,
// and trial days. Partners can now set exactly what users see on checkout —
// not just Paystack plan codes. Previously partners had no visibility into the
// prices their users were being charged.
//
// Field mapping to plan_overrides JSONB on partners table:
//   monthly_plan_code / annual_plan_code — Paystack plan identifiers
//   explorer/builder/climber_monthly_ngn / _yearly_ngn — displayed + charged amounts
//   currency   — Paystack currency code (default NGN)
//   ngn_rate   — USD→currency rate override (replaces hardcoded 1600)
//   trial_days — free trial length in days

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

interface PricingState {
  monthly_plan_code:    string;
  annual_plan_code:     string;
  enterprise_plan_code: string;
  explorer_monthly_ngn: string;
  explorer_yearly_ngn:  string;
  builder_monthly_ngn:  string;
  builder_yearly_ngn:   string;
  climber_monthly_ngn:  string;
  climber_yearly_ngn:   string;
  currency:   string;
  ngn_rate:   string;
  trial_days: string;
}

const DEFAULT: PricingState = {
  monthly_plan_code: '', annual_plan_code: '', enterprise_plan_code: '',
  explorer_monthly_ngn: '', explorer_yearly_ngn: '',
  builder_monthly_ngn:  '', builder_yearly_ngn:  '',
  climber_monthly_ngn:  '', climber_yearly_ngn:  '',
  currency: 'NGN', ngn_rate: '', trial_days: '7',
};

const INPUT: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)',
  marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em',
};
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px', padding: '18px 20px', marginBottom: '12px',
};
const HINT: React.CSSProperties = { fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '5px' };
const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const SECTION: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '12px', marginTop: '24px',
};

export default function PartnerPricingPage() {
  const [form, setForm]       = useState<PricingState>(DEFAULT);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const set = (key: keyof PricingState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    fetch('/api/partner/brand')
      .then(r => r.json())
      .then(data => {
        const o = data.plan_overrides || {};
        setForm({
          monthly_plan_code:    o.monthly_plan_code    || '',
          annual_plan_code:     o.annual_plan_code     || '',
          enterprise_plan_code: o.enterprise_plan_code || '',
          explorer_monthly_ngn: o.explorer_monthly_ngn != null ? String(o.explorer_monthly_ngn) : '',
          explorer_yearly_ngn:  o.explorer_yearly_ngn  != null ? String(o.explorer_yearly_ngn)  : '',
          builder_monthly_ngn:  o.builder_monthly_ngn  != null ? String(o.builder_monthly_ngn)  : '',
          builder_yearly_ngn:   o.builder_yearly_ngn   != null ? String(o.builder_yearly_ngn)   : '',
          climber_monthly_ngn:  o.climber_monthly_ngn  != null ? String(o.climber_monthly_ngn)  : '',
          climber_yearly_ngn:   o.climber_yearly_ngn   != null ? String(o.climber_yearly_ngn)   : '',
          currency:   o.currency   || 'NGN',
          ngn_rate:   o.ngn_rate   != null ? String(o.ngn_rate) : '',
          trial_days: o.trial_days != null ? String(o.trial_days) : '7',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const plan_overrides: Record<string, string | number | null> = {
        monthly_plan_code:    form.monthly_plan_code    || null,
        annual_plan_code:     form.annual_plan_code     || null,
        enterprise_plan_code: form.enterprise_plan_code || null,
        currency:   form.currency || 'NGN',
        trial_days: form.trial_days ? Number(form.trial_days) : 7,
      };

      const numFields: Array<keyof PricingState> = [
        'explorer_monthly_ngn', 'explorer_yearly_ngn',
        'builder_monthly_ngn',  'builder_yearly_ngn',
        'climber_monthly_ngn',  'climber_yearly_ngn',
        'ngn_rate',
      ];
      for (const f of numFields) {
        const v = form[f];
        plan_overrides[f] = v !== '' ? Number(v) : null;
      }

      const res = await fetch('/api/partner/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_overrides }),
      });
      if (!res.ok) { const err = await res.json(); setError(err.error || 'Save failed.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</div>;

  const ccy = form.currency || 'NGN';
  const planRows: Array<{ label: string; mk: keyof PricingState; yk: keyof PricingState }> = [
    { label: 'Explorer', mk: 'explorer_monthly_ngn', yk: 'explorer_yearly_ngn' },
    { label: 'Builder',  mk: 'builder_monthly_ngn',  yk: 'builder_yearly_ngn'  },
    { label: 'Climber',  mk: 'climber_monthly_ngn',  yk: 'climber_yearly_ngn'  },
  ];

  return (
    <div style={{ maxWidth: '580px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '6px' }}>Pricing</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
        Set the prices your users see and pay. Connect Paystack plan codes for recurring billing.
      </p>

      {/* Plan prices */}
      <p style={SECTION}>Plan prices ({ccy})</p>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '14px', marginTop: '-8px' }}>
        Leave blank to use Ascentor defaults (converted at the rate below or system default).
      </p>
      {planRows.map(({ label, mk, yk }) => (
        <div key={label} style={CARD}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>{label}</p>
          <div style={GRID2}>
            <div>
              <label style={LABEL}>Monthly ({ccy})</label>
              <input style={INPUT} type="number" min="0" placeholder="e.g. 14400"
                value={form[mk]} onChange={set(mk)} />
            </div>
            <div>
              <label style={LABEL}>Yearly ({ccy})</label>
              <input style={INPUT} type="number" min="0" placeholder="e.g. 104000"
                value={form[yk]} onChange={set(yk)} />
            </div>
          </div>
        </div>
      ))}

      {/* Paystack plan codes */}
      <p style={SECTION}>Paystack plan codes</p>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '14px', marginTop: '-8px' }}>
        Required for recurring billing.{' '}
        <a href="https://dashboard.paystack.com/#/plans" target="_blank" rel="noopener noreferrer"
          style={{ color: '#E8A020', textDecoration: 'none' }}>Find codes in Paystack Dashboard ↗</a>
      </p>
      <div style={CARD}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {([
            ['monthly_plan_code',    'Monthly plan code',     'Billed every 30 days'],
            ['annual_plan_code',     'Annual plan code',      'Billed once per year'],
            ['enterprise_plan_code', 'Enterprise plan code',  'Custom billing for organisations'],
          ] as const).map(([key, lbl, hint]) => (
            <div key={key}>
              <label style={LABEL}>{lbl}</label>
              <input style={INPUT} placeholder="PLN_xxxxxxxxxxxxxxx"
                value={form[key]} onChange={set(key)} />
              <p style={HINT}>{hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Currency & rate */}
      <p style={SECTION}>Currency settings</p>
      <div style={CARD}>
        <div style={GRID2}>
          <div>
            <label style={LABEL}>Currency</label>
            <select style={{ ...INPUT, appearance: 'none' as const }}
              value={form.currency} onChange={set('currency')}>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GHS">GHS — Ghanaian Cedi</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="ZAR">ZAR — South African Rand</option>
            </select>
          </div>
          <div>
            <label style={LABEL}>USD → {ccy} rate override</label>
            <input style={INPUT} type="number" min="0" placeholder="e.g. 1600"
              value={form.ngn_rate} onChange={set('ngn_rate')} />
            <p style={HINT}>Only needed if using USD prices above. Leave blank to use system default.</p>
          </div>
        </div>
      </div>

      {/* Trial */}
      <p style={SECTION}>Free trial</p>
      <div style={CARD}>
        <label style={LABEL}>Trial length (days)</label>
        <input style={{ ...INPUT, maxWidth: '140px' }} type="number" min="0" max="30"
          value={form.trial_days} onChange={set('trial_days')} />
        <p style={HINT}>Set to 0 to disable the free trial on your platform.</p>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: '13px', margin: '12px 0' }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '10px 28px', background: '#E8A020', color: '#0C0B08',
          borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Saving...' : 'Save pricing'}
        </button>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#4ade80' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
