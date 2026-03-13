// app/p/[subdomain]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
// ROOT PAGE for a white-label tenant subdomain
// e.g. acme.ascentor.co → this page
//
// Behaviour:
//  - If user is logged in → redirect to /p/[subdomain]/dashboard
//  - If user is not logged in → show tenant-branded landing page
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

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

  if (user) {
    redirect(`/p/${subdomain}/dashboard`);
  }

  // Fetch tenant name for landing copy (already validated in layout.tsx)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, accent_color')
    .eq('subdomain', subdomain)
    .single();

  const tenantName = tenant?.name || subdomain;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-lg text-center animate-fade-up">
        <div className="text-5xl mb-5">⬆</div>

        <h1
          className="text-4xl md:text-5xl font-semibold mb-3"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: 'var(--text)',
            lineHeight: 1.15,
          }}
        >
          Welcome to{' '}
          <span style={{ color: 'var(--accent)' }}>{tenantName}</span>
        </h1>

        <p
          className="text-base mb-8 max-w-md mx-auto"
          style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}
        >
          Your AI-powered coaching platform. Sign in to continue your journey.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/p/${subdomain}/signup`}
            className="px-8 py-3.5 rounded-lg font-semibold text-sm transition-colors text-center"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            Get Started →
          </Link>
          <Link
            href={`/p/${subdomain}/login`}
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
