// FILE: hooks/usePlanSync.ts
// Listens for admin-driven plan changes via Supabase Realtime.
// When the user's profile row changes, it calls router.refresh() so
// Next.js re-fetches server components AND invalidates the middleware
// cache, making tiered routes immediately accessible.
//
// Usage: call this once at the top of AppShell (or any layout that
// wraps protected routes). It is a no-op for anonymous users.
//
// WHY THIS IS NEEDED:
//   When an admin changes a user's plan, the profiles row is updated
//   in Supabase but the user's client has no idea. The middleware only
//   re-checks on navigation. Client pages (learn, experts, etc.) fetch
//   profile once on mount and cache it in React state.
//   This hook solves both problems:
//     1. router.refresh() tells Next.js to re-fetch all server components
//        → middleware re-evaluates on the next navigation
//     2. window.location.reload() (fallback) guarantees the client-side
//        profile state is also reset.

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function usePlanSync(userId: string | null | undefined) {
  const router  = useRouter()
  const prevPlan = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Seed the initial plan so we can detect changes
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_status')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) prevPlan.current = data.subscription_plan || 'free'
      })

    // Subscribe to row-level changes on this user's profile
    const channel = supabase
      .channel(`plan-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newPlan   = payload.new?.subscription_plan   || 'free'
          const newStatus = payload.new?.subscription_status || 'free'

          // Only act if the plan or status actually changed
          if (
            newPlan   !== prevPlan.current ||
            newStatus !== payload.old?.subscription_status
          ) {
            prevPlan.current = newPlan

            // 1. Bust Next.js server component cache → middleware re-runs
            router.refresh()

            // 2. If the plan was upgraded, do a full reload after a short
            //    delay so client-side state (learn page, etc.) is reset.
            //    Downgrade is handled by middleware redirect on next navigation.
            const wasUpgrade = isUpgrade(payload.old?.subscription_plan, newPlan)
            if (wasUpgrade) {
              setTimeout(() => window.location.reload(), 800)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router])
}

// ── Helper: is this a plan upgrade? ──────────────────────────
const RANK: Record<string, number> = {
  free: 0, explorer: 1, builder: 2, climber: 3,
}

function isUpgrade(oldPlan: string | undefined, newPlan: string): boolean {
  return (RANK[newPlan] ?? 0) > (RANK[oldPlan ?? 'free'] ?? 0)
}
