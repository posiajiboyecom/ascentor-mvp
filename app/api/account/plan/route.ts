// FILE: app/api/account/plan/route.ts
// Returns fresh subscription state for the current user.
// Used by client components to detect admin-driven plan changes
// without requiring a full page reload.
//
// Called by the Realtime listener in AppShell and by pages on mount.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end, billing_cycle')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ plan: 'free', status: 'free', end: null })
  }

  const isActive =
    profile.subscription_status === 'active' ||
    profile.subscription_status === 'trialing' ||
    (profile.subscription_status === 'cancelled' &&
      profile.subscription_end &&
      new Date(profile.subscription_end) > new Date())

  return NextResponse.json({
    plan:   isActive ? (profile.subscription_plan || 'free') : 'free',
    status: profile.subscription_status || 'free',
    end:    profile.subscription_end,
    cycle:  profile.billing_cycle,
  })
}
