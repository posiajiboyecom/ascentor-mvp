// ============================================================
// app/p/[subdomain]/page.tsx
// Root landing page for partner subdomain
// e.g. amara.ascentorbi.com → shows partner's branded home
// ============================================================

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartnerContext } from '@/lib/getPartnerContext';
import Link from 'next/link';

export default async function PartnerHomePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const ctx = await getPartnerContext(hostname);
  const { partner } = ctx;
  const { brand } = partner;

  // If user is already logged in, send to dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/dashboard`);

  const features = partner.features;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={brand.platform_name} style={{ height: 32, width: 'auto' }} />
            : <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                {brand.platform_name}
              </span>
          }
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/login`}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: 'var(--text)', border: '1px solid var(--border)',
              textDecoration: 'none', background: 'transparent',
            }}>
            Log in
          </Link>
          <Link href={`/signup`}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: 'var(--accent)', color: '#000',
              textDecoration: 'none', border: 'none',
            }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{
        maxWidth: 640, margin: '0 auto', padding: '80px 24px 60px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 700,
          color: 'var(--text)',
          lineHeight: 1.15,
          marginBottom: 16,
        }}>
          Welcome to{' '}
          <span style={{ color: 'var(--accent)' }}>{brand.platform_name}</span>
        </h1>

        {brand.tagline && (
          <p style={{
            fontSize: 16, color: 'var(--text-muted)',
            lineHeight: 1.7, marginBottom: 36,
          }}>
            {brand.tagline}
          </p>
        )}

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
          {features.ai_coach   && <Pill>AI Coaching 24/7</Pill>}
          {features.community   && <Pill>Peer Community</Pill>}
          {features.experts     && <Pill>Expert Sessions</Pill>}
          {features.courses     && <Pill>Structured Courses</Pill>}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={`/signup`}
            style={{
              padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: 'var(--accent)', color: '#000', textDecoration: 'none',
            }}>
            Start your journey →
          </Link>
          {features.ai_coach && (
            <Link href={`/login`}
              style={{
                padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                color: 'var(--text)', border: '1px solid var(--border)',
                textDecoration: 'none', background: 'transparent',
              }}>
              Already a member
            </Link>
          )}
        </div>
      </div>

      {/* ── Powered by footer ── */}
      {!brand.hide_ascentor_branding && (
        <div style={{
          textAlign: 'center', padding: '24px', fontSize: 11,
          color: 'var(--text-dim)',
          borderTop: '1px solid var(--border)',
          marginTop: 60,
        }}>
          Powered by{' '}
          <a href="https://ascentorbi.com" target="_blank" rel="noopener noreferrer"
            style={{ color: '#E8A020', textDecoration: 'none' }}>
            Ascentor
          </a>
        </div>
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: 'rgba(255,255,255,0.05)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border)',
    }}>
      {children}
    </span>
  );
}
