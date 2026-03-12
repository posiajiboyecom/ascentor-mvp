// ============================================================
// app/partner/settings/page.tsx
//
// FILE LOCATION: app/partner/settings/page.tsx
//
// FIX (W-08):
//   The Paystack key field always appeared empty even when a key
//   was saved (the API correctly never returns the encrypted key
//   to the client). Coaches couldn't tell if their key was saved.
//
//   Fix:
//   - On load, read `has_paystack_key: boolean` from the GET
//     /api/partner/brand response (see also the API route fix).
//   - When has_paystack_key is true, show a green "✓ Paystack
//     connected" badge above the input field.
//   - The input placeholder changes to "Enter new key to replace"
//     when a key is already saved, so the coach understands they
//     are replacing, not adding for the first time.
//   - Leaving the input blank when saving preserves the existing
//     key (no accidental key deletion).
//
// FIX (W-22):
//   Heading fontFamily was hardcoded as 'Cormorant Garamond'.
//   Changed to 'var(--font-heading)' throughout.
// ============================================================

'use client';

import { useState, useEffect } from 'react';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

export default function PartnerSettingsPage() {
  const [partner, setPartner]             = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState('');

  const [customDomain, setCustomDomain]   = useState('');
  const [paystackKey, setPaystackKey]     = useState('');
  // FIX W-08: track whether a key is already saved server-side
  const [hasPaystackKey, setHasPaystackKey] = useState(false);

  const [trialDays, setTrialDays]         = useState(7);
  const [features, setFeatures]           = useState({
    ai_coach: true, community: true, experts: false,
    courses: true, referrals: true,
  });
  const [planNames, setPlanNames]         = useState({
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
          // FIX W-08: read has_paystack_key from API response
          setHasPaystackKey(Boolean(p.has_paystack_key));
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

  const [domainStatus, setDomainStatus] = useState<null | { verified: boolean; cname_target?: string; message?: string }>(null);
  const [provisioningDomain, setProvisioningDomain] = useState(false);

  useEffect(() => {
    fetch('/api/partner/domain')
      .then(r => r.json())
      .then(data => {
        if (data.domain) setDomainStatus({ verified: data.verified });
      }).catch(() => {});
  }, []);

  const handleProvisionDomain = async () => {
    if (!partner || !customDomain.trim()) return;
    setProvisioningDomain(true); setError('');
    const res = await fetch('/api/partner/domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId: partner.id, domain: customDomain.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setDomainStatus({ verified: data.verified, cname_target: data.cname_target, message: data.message });
    } else {
      setError(data.error || 'Domain provisioning failed');
    }
    setProvisioningDomain(false);
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
        // Only send key if the coach typed a new one — blank = keep existing
        paystack_secret_key: paystackKey.trim() || undefined,
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
    if (!res.ok) {
      setError(data.error || 'Save failed');
    } else {
      setSaved(true);
      // If we just saved a new key, mark it as connected and clear the field
      if (paystackKey.trim()) {
        setHasPaystackKey(true);
        setPaystackKey('');
      }
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading...</div>;
  }

  return (
    <div className="animate-fade-up" style={{ maxWidth: 580 }}>
      {/* FIX W-22: var(--font-heading) not hardcoded Cormorant Garamond */}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={customDomain}
                onChange={e => { setCustomDomain(e.target.value); setDomainStatus(null); }}
                placeholder="coaching.yourdomain.com"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleProvisionDomain}
                disabled={provisioningDomain || !customDomain.trim()}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#000',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  opacity: (provisioningDomain || !customDomain.trim()) ? 0.5 : 1,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                {provisioningDomain ? 'Connecting...' : 'Connect'}
              </button>
            </div>
            {domainStatus && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 10,
                background: domainStatus.verified ? 'rgba(16,185,129,0.06)' : 'rgba(232,160,32,0.06)',
                border: `1px solid ${domainStatus.verified ? 'rgba(16,185,129,0.2)' : 'rgba(232,160,32,0.2)'}`,
              }}>
                <p style={{
                  fontSize: 12, fontWeight: 600,
                  color: domainStatus.verified ? 'var(--success)' : 'var(--accent)',
                  marginBottom: domainStatus.message ? 4 : 0,
                }}>
                  {domainStatus.verified ? '✓ Domain is live' : '◎ Pending DNS verification'}
                </p>
                {domainStatus.message && (
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    {domainStatus.message}
                  </p>
                )}
                {domainStatus.cname_target && !domainStatus.verified && (
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                    CNAME target: <code style={{ color: 'var(--accent)', fontSize: 10 }}>{domainStatus.cname_target}</code>
                  </p>
                )}
              </div>
            )}
            {!domainStatus && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
                Enter your domain and click Connect. We will automatically provision SSL via Vercel.
              </p>
            )}
          </Field>
        </Section>

        {/* ── Paystack integration — FIX W-08 ── */}
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

          {/* FIX W-08: Show connection badge when key is already saved */}
          {hasPaystackKey && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10, marginBottom: 10,
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--success)' }}>✓</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                  Paystack connected
                </span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-dim)',
              }}>
                Key saved securely
              </span>
            </div>
          )}

          <Field label={hasPaystackKey ? 'Replace Paystack Key' : 'Your Paystack Secret Key (sk_live_...)'}>
            <input
              value={paystackKey}
              onChange={e => setPaystackKey(e.target.value)}
              // FIX W-08: placeholder changes based on whether a key exists
              placeholder={hasPaystackKey ? 'Enter new key to replace existing key' : 'sk_live_xxxxxxxxxxxxxxxxxxxxxxxx'}
              type="password"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              {hasPaystackKey
                ? 'Leave blank to keep your current key. Enter a new key only if you want to replace it.'
                : 'Stored encrypted. Never exposed to clients.'
              }
              {' '}Register webhook:{' '}
              <code style={{ color: 'var(--accent)', fontSize: 10 }}>
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
          {saved && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>✓ Saved</span>}
          {error && <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
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
      {title && (
        <p style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 14,
        }}>
          {title}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
        display: 'block', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
