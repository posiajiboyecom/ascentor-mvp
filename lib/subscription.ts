// lib/subscription.ts
import { createServerClient } from '@supabase/ssr'

export async function getUserPlan(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'free'

  const { data } = await supabase
    .from('subscriptions')
    .select('plan_name, status')
    .eq('user_id', user.id)
    .single()

  if (!data || data.status !== 'active') return 'free'
  return data.plan_name?.toLowerCase() ?? 'free'
}