// lib/subscription.ts
// M-2 fix: was querying 'subscriptions' table which nothing writes to.
// All payment handlers write subscription state to 'profiles'.
// This now reads from profiles — the actual source of truth.

import { createServerClient } from '@supabase/ssr'

export async function getUserPlan(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'free'

  const { data } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end')
    .eq('id', user.id)
    .single()

  if (!data) return 'free'

  // Not active or trialing → free
  if (!['active', 'trialing'].includes(data.subscription_status ?? '')) return 'free'

  // Expired subscription → free
  if (data.subscription_end && new Date(data.subscription_end) < new Date()) return 'free'

  return data.subscription_plan?.toLowerCase() ?? 'free'
}