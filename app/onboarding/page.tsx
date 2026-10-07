// app/onboarding/page.tsx
// The 12-step onboarding. Server component: loads what the member has already saved so they can resume,
// then hands off to the client flow. Finished members go straight to Today.

import { redirect } from 'next/navigation';
import OnboardingFlow, { type OnboardingInitial } from '@/components/rx/onboarding/OnboardingFlow';
import { loadOnboardingState } from './actions';
import { OB_ORDER, type ObStep } from '@/lib/rx/constants';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function usable(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v && v.toLowerCase() !== 'new user' ? v : '';
}

export default async function OnboardingPage({ searchParams }: { searchParams?: Promise<{ redo?: string }> }) {
  const sp = (await searchParams) ?? {};
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const s = await loadOnboardingState();
  // Members who finished the earlier onboarding can reopen it from Today to set up their Circle and profile.
  if (s.completed && sp.redo !== '1' ) redirect('/dashboard');

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = usable(s.fullName) || usable(meta.full_name) || usable(meta.name) || [usable(meta.given_name), usable(meta.family_name)].filter(Boolean).join(' ') || (user.email?.split('@')[0] ?? 'there');

  const mp = s.profile as (Record<string, unknown> & { baseline?: { answers?: (number | null)[]; goals?: { g: string; who: string }[] } }) | null;
  const saved = (mp?.onboarding_step as string | null) ?? null;
  // Resume where they stopped: the step after the last one saved. Fresh members see the welcome.
  let step: ObStep = 'welcome';
  if (saved && (OB_ORDER as string[]).includes(saved) && saved !== 'welcome') {
    const i = OB_ORDER.indexOf(saved as ObStep);
    step = OB_ORDER[Math.min(i + 1, OB_ORDER.indexOf('survey'))];
  }

  const initial: OnboardingInitial = {
    step,
    firstName: name.split(/\s+/)[0],
    email: s.email,
    userId: s.userId,
    alreadyCompleted: s.completed,
    interests: (mp?.interests as string[]) ?? [],
    purpose: (mp?.purpose_score as number | null) ?? null,
    effort: (mp?.effort_score as number | null) ?? null,
    lead: (mp?.lead_exp as string | null) ?? null,
    project: (mp?.project_exp as string | null) ?? null,
    goals: mp?.baseline?.goals ?? [],
    slots: (mp?.slots as string[]) ?? [],
    timezone: (mp?.timezone as string | null) ?? null,
    timezoneLabel: (mp?.timezone_label as string | null) ?? null,
    language: (mp?.language as string | null) ?? null,
    answers: mp?.baseline?.answers ?? [],
  };

  return <OnboardingFlow initial={initial} />;
}
