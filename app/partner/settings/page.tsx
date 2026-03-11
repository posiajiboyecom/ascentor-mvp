// ============================================================
// app/partner/settings/page.tsx
// Platform config — custom domain, Paystack key, plan names,
// trial days, feature toggles
// ============================================================

'use client';

import { useState, useEffect } from 'react';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

export default function PartnerSettingsPage() {
  const [partner, setPartner]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  const [customDomain, setCustomDomain]         = useState('');
  const [paystackKey, setPaystackKey]           = useState('');
  const [trialDays, setTrialDays]               = useState(7);
  const [features, setFeatures]                 = useState({
    ai_coach: true, community: true, experts: false,
    courses: true, referrals: true,
  });
  const [planNames, setPlanNames]   = useState({
    explorer: '', builder: '', climber: '',
  });

  useEffect(() => {
    fetch('/api/partner/brand')
      .then(r => r.json())
      .then(data => {
        if (data.partner) {
          const p = data.partner;
          setPartner(p);
          setCustomDomain(p.custom_domain || '');
          setFeatures(p.features || features);
          const overrides = p.plan_overrides || {};
          setTrialDays(overrides.trial_days ?? 7);
          setPlanNames({
            explorer: overrides.explorer_name || '',
            builder:  overrides.builder_name  || '',
            climber:  overrides.climber_name  || '',
          });
        }
        setLoading(false);
      });
  }, []);

  const toggleFeature = (key: keyof typeof features) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!partner) return;
    setSaving(true); setError(''); setSaved(false);

    const res = await fetch('/api/partner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerId: partner.id,
        custom_domain: customDomain.trim() || null,
        paystack_secret_key: paystackKey || undefined,
        features,
        plan_overrides: {
          trial_days:    trialDays,
          explorer_name: planNames.explorer || null,
          builder_name:  planNames.builder  || null,
          climber_name:  planNames.climber  || null,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Save failed'); }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading...</div>;
  }

  return (
    <div className="animate-fade-up" style={{ maxWidth: 580 }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
        Settings
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 28 }}>
        Platform configuration and integrations
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Platform identity ── */}
        <Section title="Your Platform URL">
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
              SUBDOMAIN (PERMANENT)
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
              https://{partner?.subdomain}.ascentorbi.com
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              This is fixed. Share it with your members anytime.
            </p>
          </div>

          <Field label="Custom Domain (Optional)">
            <input
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="coaching.yourdomain.com"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
              Point a CNAME from your domain to <code style={{ color: 'var(--accent)' }}>cname.vercel-dns.com</code>,
              then enter it here. Allow 30 minutes for SSL.
            </p>
          </Field>
        </Section>

        {/* ── Paystack integration ── */}
        <Section title="Paystack Integration">
          <div style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 12,
            background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Optional: Use your own Paystack account to receive payments directly.
              If left blank, Ascentor processes payments and pays your share monthly.
            </p>
          </div>
          <Field label="Your Paystack Secret Key (sk_live_...)">
            <input
              value={paystackKey}
              onChange={e => setPaystackKey(e.target.value)}
              placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
              type="password"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              Stored encrypted. Never exposed to clients.
              Register webhook: <code style={{ color: 'var(--accent)', fontSize: 10 }}>
                https://ascentorbi.com/api/partner/webhook?partner_id={partner?.id}
              </code>
            </p>
          </Field>
        </Section>

        {/* ── Trial days ── */}
        <Section title="Trial Period">
          <Field label="Free Trial Days">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number" min={0} max={30}
                value={trialDays}
                onChange={e => setTrialDays(parseInt(e.target.value) || 0)}
                style={{ ...inputStyle, width: 100 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                days before members are charged
              </span>
            </div>
          </Field>
        </Section>

        {/* ── Plan name overrides ── */}
        <Section title="Plan Names">
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
            Rename plans to match your brand. Leave blank to use defaults (Explorer, Builder, Climber).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {(['explorer', 'builder', 'climber'] as const).map(plan => (
              <Field key={plan} label={plan.charAt(0).toUpperCase() + plan.slice(1)}>
                <input
                  value={planNames[plan]}
                  onChange={e => setPlanNames(prev => ({ ...prev, [plan]: e.target.value }))}
                  placeholder={plan.charAt(0).toUpperCase() + plan.slice(1)}
                  style={inputStyle}
                />
              </Field>
            ))}
          </div>
        </Section>

        {/* ── Feature toggles ── */}
        <Section title="Features">
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
            Enable only the features relevant to your coaching platform.
          </p>
          {([
            ['ai_coach',  'AI Coach (Sage)',   'AI-powered coaching conversations'],
            ['community', 'Community',         'Member discussion circle'],
            ['experts',   'Expert Sessions',   'Live sessions with specialists'],
            ['courses',   'Courses',           'Structured learning paths'],
            ['referrals', 'Referrals',         'Member referral rewards'],
          ] as const).map(([key, label, desc]) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</p>
              </div>
              <button
                onClick={() => toggleFeature(key)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: features[key] ? 'var(--accent)' : 'var(--bg-input)',
                  transition: 'all 0.2s', position: 'relative', flexShrink: 0,
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', position: 'absolute', top: 3,
                  transition: 'all 0.2s',
                  left: features[key] ? 23 : 3,
                  background: features[key] ? '#000' : 'var(--text-dim)',
                }} />
              </button>
            </div>
          ))}
        </Section>

        {/* ── Save ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#000',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.5 : 1,
            }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved  && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>✓ Saved</span>}
          {error  && <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 14 }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
