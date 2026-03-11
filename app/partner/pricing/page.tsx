// ============================================================
// app/partner/pricing/page.tsx
// Partner sets their own plan prices in Naira.
// Feeds directly into PartnerCheckoutClient via plan_overrides.
// ============================================================

'use client';

import { useState, useEffect } from 'react';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

const PLAN_COLORS = {
  explorer: '#14B8A6',
  builder:  '#E8A020',
  climber:  '#8B5CF6',
};

const PLAN_DEFAULTS = {
  explorer: { name: 'Explorer', monthly_ngn: 5000,  yearly_ngn: 50000  },
  builder:  { name: 'Builder',  monthly_ngn: 12000, yearly_ngn: 120000 },
  climber:  { name: 'Climber',  monthly_ngn: 25000, yearly_ngn: 250000 },
};

type PlanKey = 'explorer' | 'builder' | 'climber';

interface PlanConfig {
  name: string;
  monthly_ngn: number;
  yearly_ngn: number;
  features: string;
}

export default function PartnerPricingPage() {
  const [partnerId, setPartnerId]   = useState<string | null>(null);
  const [trialDays, setTrialDays]   = useState(7);
  const [plans, setPlans]           = useState<Record<PlanKey, PlanConfig>>({
    explorer: { ...PLAN_DEFAULTS.explorer, features: '' },
    builder:  { ...PLAN_DEFAULTS.builder,  features: '' },
    climber:  { ...PLAN_DEFAULTS.climber,  features: '' },
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/partner/brand')
      .then(r => r.json())
      .then(data => {
        if (data.partner) {
          const p = data.partner;
          setPartnerId(p.id);
          const ov = p.plan_overrides || {};
          setTrialDays(ov.trial_days ?? 7);
          setPlans({
            explorer: {
              name:        ov.explorer_name || 'Explorer',
              monthly_ngn: ov.explorer_monthly_ngn || PLAN_DEFAULTS.explorer.monthly_ngn,
              yearly_ngn:  ov.explorer_yearly_ngn  || PLAN_DEFAULTS.explorer.yearly_ngn,
              features:    ov.explorer_features || '',
            },
            builder: {
              name:        ov.builder_name || 'Builder',
              monthly_ngn: ov.builder_monthly_ngn || PLAN_DEFAULTS.builder.monthly_ngn,
              yearly_ngn:  ov.builder_yearly_ngn  || PLAN_DEFAULTS.builder.yearly_ngn,
              features:    ov.builder_features || '',
            },
            climber: {
              name:        ov.climber_name || 'Climber',
              monthly_ngn: ov.climber_monthly_ngn || PLAN_DEFAULTS.climber.monthly_ngn,
              yearly_ngn:  ov.climber_yearly_ngn  || PLAN_DEFAULTS.climber.yearly_ngn,
              features:    ov.climber_features || '',
            },
          });
        }
        setLoading(false);
      });
  }, []);

  const updatePlan = (key: PlanKey, field: keyof PlanConfig, value: any) => {
    setPlans(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    if (!partnerId) return;
    setSaving(true); setError(''); setSaved(false);

    const res = await fetch('/api/partner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerId,
        plan_overrides: {
          trial_days:           trialDays,
          explorer_name:        plans.explorer.name || null,
          builder_name:         plans.builder.name  || null,
          climber_name:         plans.climber.name  || null,
          // Store NGN prices directly
          explorer_monthly_ngn: Number(plans.explorer.monthly_ngn) || 0,
          explorer_yearly_ngn:  Number(plans.explorer.yearly_ngn)  || 0,
          builder_monthly_ngn:  Number(plans.builder.monthly_ngn)  || 0,
          builder_yearly_ngn:   Number(plans.builder.yearly_ngn)   || 0,
          climber_monthly_ngn:  Number(plans.climber.monthly_ngn)  || 0,
          climber_yearly_ngn:   Number(plans.climber.yearly_ngn)   || 0,
          explorer_features:    plans.explorer.features || null,
          builder_features:     plans.builder.features  || null,
          climber_features:     plans.climber.features  || null,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Save failed'); }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  if (loading) return <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }} className="animate-fade-up">
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28,
        color: 'var(--text)', marginBottom: 4 }}>
        Pricing
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 32 }}>
        Set your membership prices in Naira. These are shown on your checkout page.
      </p>

      {/* Trial period */}
      <Section title="Free Trial">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <input
            type="number" min={0} max={30}
            value={trialDays}
            onChange={e => setTrialDays(parseInt(e.target.value) || 0)}
            style={{ ...inputStyle, width: 80 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            free days before members are charged. Set to 0 to disable.
          </span>
        </div>
      </Section>

      {/* Plan pricing */}
      {(Object.keys(plans) as PlanKey[]).map(key => {
        const plan = plans[key];
        const color = PLAN_COLORS[key];
        const yearlySaving = plan.monthly_ngn > 0
          ? Math.round(((plan.monthly_ngn * 12) - plan.yearly_ngn) / (plan.monthly_ngn * 12) * 100)
          : 0;

        return (
          <Section key={key} title="">
            {/* Plan header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, flexShrink: 0,
              }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color, margin: 0 }}>
                {plan.name || key.charAt(0).toUpperCase() + key.slice(1)} Plan
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {/* Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Label>Plan Name</Label>
                <input
                  value={plan.name}
                  onChange={e => updatePlan(key, 'name', e.target.value)}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  style={inputStyle}
                />
              </div>

              {/* Monthly */}
              <div>
                <Label>Monthly Price (₦)</Label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, color: 'var(--text-dim)', pointerEvents: 'none',
                  }}>₦</span>
                  <input
                    type="number" min={0}
                    value={plan.monthly_ngn}
                    onChange={e => updatePlan(key, 'monthly_ngn', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, paddingLeft: 26 }}
                  />
                </div>
              </div>

              {/* Yearly */}
              <div>
                <Label>Yearly Price (₦)</Label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, color: 'var(--text-dim)', pointerEvents: 'none',
                  }}>₦</span>
                  <input
                    type="number" min={0}
                    value={plan.yearly_ngn}
                    onChange={e => updatePlan(key, 'yearly_ngn', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, paddingLeft: 26 }}
                  />
                </div>
              </div>

              {/* Saving calc */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {yearlySaving > 0 ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    background: 'rgba(16,185,129,0.08)', color: '#10B981',
                    border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    Saves {yearlySaving}% yearly
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    Set yearly &lt; monthly×12 to show savings
                  </span>
                )}
              </div>

              {/* Feature list */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Label>Features (one per line — shown on checkout)</Label>
                <textarea
                  value={plan.features}
                  onChange={e => updatePlan(key, 'features', e.target.value)}
                  rows={3}
                  placeholder={`AI coaching sessions\nCommunity access\nWeekly expert Q&A`}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </Section>
        );
      })}

      {/* Preview */}
      <Section title="Checkout Preview">
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>
          This is how your pricing will appear to members.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {(Object.keys(plans) as PlanKey[]).map(key => {
            const plan = plans[key];
            const color = PLAN_COLORS[key];
            return (
              <div key={key} style={{
                padding: '16px 14px', borderRadius: 12,
                background: 'var(--bg-input)',
                border: `1px solid ${color}30`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {plan.name}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)',
                  fontFamily: "'Cormorant Garamond', serif", marginBottom: 2 }}>
                  ₦{Number(plan.monthly_ngn).toLocaleString()}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>per month</p>
                {plan.features && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {plan.features.split('\n').filter(Boolean).slice(0, 4).map((f, i) => (
                      <p key={i} style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 5 }}>
                        <span style={{ color }}>✓</span> {f}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
        <button onClick={handleSave} disabled={saving}
          style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#000',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}>
          {saving ? 'Saving...' : 'Save Pricing'}
        </button>
        {saved  && <span style={{ fontSize: 13, fontWeight: 600, color: '#10B981' }}>✓ Saved</span>}
        {error  && <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px', marginBottom: 16,
    }}>
      {title && (
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 14 }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--text-dim)', marginBottom: 6,
    }}>
      {children}
    </label>
  );
}
