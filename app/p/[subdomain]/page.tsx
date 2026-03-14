// app/p/[subdomain]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE for a white-label partner subdomain.
// e.g. demo.ascentorbi.com → proxy rewrites to /p/demo → this page
//
// Behaviour:
//  - Logged in  → redirect to /dashboard  (proxy rewrites it transparently;
//                 NEVER redirect to /p/[subdomain]/dashboard — that exposes
//                 the internal rewrite path and causes a 404)
//  - Logged out → show partner-branded landing page
//
// BUGS FIXED:
//  - Was redirecting to `/p/${subdomain}/dashboard` (internal path → 404).
//    Fixed: redirect to `/dashboard` — proxy handles the rewrite.
//  - Was querying dead `tenants` table. Fixed: queries `partners` table.
//  - Was using emoji (⬆) instead of SVG. Fixed: inline SVG icon.
//  - Nav hrefs were `/p/${subdomain}/signup` (internal). Fixed: `/signup`.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function SubdomainHomePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── FIX: redirect to /dashboard, NOT /p/${subdomain}/dashboard ──
  // The proxy (proxy.ts) rewrites demo.ascentorbi.com/dashboard →
  // /p/demo/dashboard internally. Redirecting to the internal path
  // bypasses the proxy and exposes /p/demo/dashboard in the browser,
  // which Next.js has no direct route for → 404.
  if (user) {
    redirect('/dashboard');
  }

  // Fetch partner brand for landing copy.
  // Layout.tsx has already validated the partner exists and is active,
  // so this is a display-only query — failure is non-fatal.
  const { data: partner } = await supabaseService
    .from('partners')
    .select('name, brand')
    .eq('subdomain', subdomain.toLowerCase())
    .eq('status', 'active')
    .single();

  const platformName = (partner?.brand as any)?.platform_name || partner?.name || subdomain;
  const tagline      = (partner?.brand as any)?.tagline as string | null;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-lg text-center">

        {/* SVG icon — no emoji */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="24" cy="24" r="23" stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
            <path
              d="M24 34V14M16 22l8-8 8 8"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          className="text-4xl md:text-5xl font-semibold mb-3"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--text)',
            lineHeight: 1.15,
          }}
        >
          Welcome to{' '}
          <span style={{ color: 'var(--accent)' }}>{platformName}</span>
        </h1>

        <p
          className="text-base mb-8 max-w-md mx-auto"
          style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}
        >
          {tagline ?? 'Your AI-powered coaching platform. Sign in to continue your journey.'}
        </p>

        {/* ── FIX: hrefs are root-relative — proxy rewrites them ── */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-colors text-center"
            style={{ background: 'var(--accent)', color: '#0C0B08' }}
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-colors text-center"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
