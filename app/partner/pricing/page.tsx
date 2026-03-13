// app/partner/pricing/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

export default function PartnerPricingPage() {
  const [plans, setPlans] = useState({ monthly: '', annual: '', enterprise: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partner/brand')
      .then((r) => r.json())
      .then((data) => {
        const overrides = data.plan_overrides || {};
        setPlans({
          monthly: overrides.monthly_plan_code || '',
          annual: overrides.annual_plan_code || '',
          enterprise: overrides.enterprise_plan_code || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/partner/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_overrides: {
            monthly_plan_code:    plans.monthly    || null,
            annual_plan_code:     plans.annual     || null,
            enterprise_plan_code: plans.enterprise || null,
          }
        }),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error || 'Failed to save.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</div>;

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block' as const, fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div style={{ maxWidth: '520px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '6px' }}>Pricing</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
        Connect your Paystack plan codes so users on your platform can subscribe.
      </p>
      <a
        href="https://dashboard.paystack.com/#/plans"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: '12px', color: '#14b8a6', display: 'inline-block', marginBottom: '28px' }}
      >
        Find your plan codes in Paystack Dashboard ↗
      </a>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px' }}>
          <label style={labelStyle}>Monthly plan code</label>
          <input
            style={inputStyle}
            placeholder="PLN_xxxxxxxxxxxxxxx"
            value={plans.monthly}
            onChange={(e) => setPlans({ ...plans, monthly: e.target.value })}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
            Billed every 30 days
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px' }}>
          <label style={labelStyle}>Annual plan code</label>
          <input
            style={inputStyle}
            placeholder="PLN_xxxxxxxxxxxxxxx"
            value={plans.annual}
            onChange={(e) => setPlans({ ...plans, annual: e.target.value })}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
            Billed once per year
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px' }}>
          <label style={labelStyle}>Enterprise plan code <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>(optional)</span></label>
          <input
            style={inputStyle}
            placeholder="PLN_xxxxxxxxxxxxxxx"
            value={plans.enterprise}
            onChange={(e) => setPlans({ ...plans, enterprise: e.target.value })}
          />
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
            Custom billing for organisations
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 24px', background: '#14b8a6', color: '#000', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving...' : 'Save pricing'}
        </button>
        {saved && <span style={{ fontSize: '13px', color: '#4ade80' }}>✓ Saved</span>}
      </div>
    </div>
  );
}
