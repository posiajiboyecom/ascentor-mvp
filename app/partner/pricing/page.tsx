// ============================================================
// app/partner/pricing/page.tsx
//
// FILE LOCATION: app/partner/pricing/page.tsx
//
// FIXES:
//   W-10 — The yearly saving badge ("SAVE 17%") was hardcoded.
//           Now computed dynamically per plan:
//             pct = Math.round(((monthly*12) - yearly) / (monthly*12) * 100)
//           Badge only renders when pct > 0. When monthly = 0 or
//           yearly >= monthly*12, badge is hidden entirely.
//
//   W-22 — Heading fontFamily was hardcoded 'Cormorant Garamond'.
//           Changed to 'var(--font-heading)'.
// ============================================================

'use client';

import { useState, useEffect } from 'react';

type PlanKey = 'explorer' | 'builder' | 'climber';

interface PlanConfig {
  name:        string;
  monthly_ngn: number;
  yearly_ngn:  number;
  features:    string;
}

const PLAN_DEFAULTS: Record<PlanKey, PlanConfig> = {
  explorer: { name: 'Explorer', monthly_ngn: 5000,  yearly_ngn: 50000,  features: '' },
  builder:  { name: 'Builder',  monthly_ngn: 12000, yearly_ngn: 120000, features: '' },
  climber:  { name: 'Climber',  monthly_ngn: 25000, yearly_ngn: 250000, features: '' },
};

const PLAN_COLORS: Record<PlanKey, string> = {
  explorer: '#14B8A6',
  builder:  '#E8A020',
  climber:  '#8B5CF6',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

export default function PricingAdminPage() {
  const [partnerId, setPartnerId]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');
  const [trialDays, setTrialDays]   = useState(7);
  const [plans, setPlans]           = useState<Record<PlanKey, PlanConfig>>({ ...PLAN_DEFAULTS });

  useEffect(() => {
    fetch('/api/partner/brand')
      .then(r => r.json())
      .then(data => {
        if (data.partner) {
          const p  = data.partner;
          setPartnerId(p.id);
          const ov = p.plan_overrides || {};
          setTrialDays(ov.trial_days ?? 7);
          setPlans({
            explorer: {
              name:        ov.explorer_name        || PLAN_DEFAULTS.explorer.name,
              monthly_ngn: ov.explorer_monthly_ngn || PLAN_DEFAULTS.explorer.monthly_ngn,
              yearly_ngn:  ov.explorer_yearly_ngn  || PLAN_DEFAULTS.explorer.yearly_ngn,
              features:    ov.explorer_features    || '',
            },
            builder: {
              name:        ov.builder_name        || PLAN_DEFAULTS.builder.name,
              monthly_ngn: ov.builder_monthly_ngn || PLAN_DEFAULTS.builder.monthly_ngn,
              yearly_ngn:  ov.builder_yearly_ngn  || PLAN_DEFAULTS.builder.yearly_ngn,
              features:    ov.builder_features    || '',
            },
            climber: {
              name:        ov.climber_name        || PLAN_DEFAULTS.climber.name,
              monthly_ngn: ov.climber_monthly_ngn || PLAN_DEFAULTS.climber.monthly_ngn,
              yearly_ngn:  ov.climber_yearly_ngn  || PLAN_DEFAULTS.climber.yearly_ngn,
              features:    ov.climber_features    || '',
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
      {/* FIX W-22: var(--font-heading) */}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>
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
        const plan  = plans[key];
        const color = PLAN_COLORS[key];

        // FIX W-10: dynamic saving percentage — hide badge when ≤ 0
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
                <Label>
                  Yearly Price (₦){' '}
                  {/* FIX W-10: badge only shows when saving is actually positive */}
                  {yearlySaving > 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: 9, fontWeight: 700,
                      background: 'rgba(16,185,129,0.12)',
                      color: 'var(--success)',
                      padding: '2px 6px', borderRadius: 4, verticalAlign: 'middle',
                    }}>
                      SAVE {yearlySaving}%
                    </span>
                  )}
                </Label>
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
                {yearlySaving > 0 && (
                  <p style={{ fontSize: 10, color: 'var(--success)', marginTop: 4 }}>
                    Members save ₦{((plan.monthly_ngn * 12) - plan.yearly_ngn).toLocaleString()} per year
                  </p>
                )}
              </div>

              {/* Features list */}
              <div>
                <Label>Features (one per line)</Label>
                <textarea
                  rows={3}
                  value={plan.features}
                  onChange={e => updatePlan(key, 'features', e.target.value)}
                  placeholder="e.g. Weekly check-ins&#10;AI coach access&#10;Group sessions"
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </Section>
        );
      })}

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#000',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}>
          {saving ? 'Saving...' : 'Save Pricing'}
        </button>
        {saved && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>✓ Saved</span>}
        {error && <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', padding: '16px 18px',
      marginBottom: 16,
    }}>
      {title && (
        <p style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 14,
        }}>
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
      fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
      display: 'block', marginBottom: 6,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {children}
    </label>
  );
}
