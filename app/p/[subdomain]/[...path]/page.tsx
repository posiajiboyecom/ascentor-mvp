// app/p/[subdomain]/[...path]/page.tsx

// CRITICAL: Force dynamic rendering — never statically pre-render this route.
// Without this, Next.js tries to pre-render at build time, hits Supabase,
// and the build hangs indefinitely.
export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Root-relative /login — proxy rewrites it to the partner login page transparently.
  // NEVER use /p/${subdomain}/login — that exposes the internal path → 404.
  if (!user) redirect('/login');
  return user;
}

export default async function TenantSubPage({
  params,
}: {
  params: Promise<{ subdomain: string; path: string[] }>;
}) {
  const { subdomain, path } = await params;
  const route = path?.join('/') || '';

  // ── Public routes (lazy imports — no static analysis at build time) ────────
  if (route === 'login') {
    const { default: LoginPage } = await import('@/app/login/page');
    return <LoginPage />;
  }
  if (route === 'signup') {
    const { default: SignupPage } = await import('@/app/signup/page');
    return <SignupPage />;
  }
  if (route === 'onboarding') {
    const { default: OnboardingPage } = await import('@/app/onboarding/page');
    return <OnboardingPage />;
  }

  // ── Protected routes ───────────────────────────────────────────────────────
  await requireAuth();

  if (route === '' || route === 'dashboard') {
    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page');
    return <DashboardPage />;
  }
  if (route === 'coach') {
    const { default: CoachPage } = await import('@/app/(app)/coach/page');
    return <CoachPage />;
  }
  if (route === 'account') {
    const { default: AccountPage } = await import('@/app/(app)/account/page');
    return <AccountPage />;
  }
  if (route === 'learn') {
    const { default: LearnPage } = await import('@/app/(app)/learn/page');
    return <LearnPage />;
  }
  if (route === 'community') {
    const { default: CommunityPage } = await import('@/app/(app)/community/page');
    return <CommunityPage />;
  }
  if (route === 'referral') {
    const { default: ReferralPage } = await import('@/app/(app)/referral/page');
    return <ReferralPage />;
  }

  notFound();
}
