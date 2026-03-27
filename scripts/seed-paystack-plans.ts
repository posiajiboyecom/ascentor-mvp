#!/usr/bin/env ts-node
// scripts/seed-paystack-plans.ts
//
// Creates all Paystack subscription plans via the API and prints the
// plan codes to paste into app/pricing/data.ts.
//
// Usage:
//   PAYSTACK_SECRET_KEY=sk_live_xxx npx ts-node scripts/seed-paystack-plans.ts
//
// Run ONCE. Safe to re-run — it checks for existing plans first and skips duplicates.

const SECRET = process.env.PAYSTACK_SECRET_KEY
if (!SECRET) {
  console.error('❌  Set PAYSTACK_SECRET_KEY env var before running this script.')
  process.exit(1)
}

// Paystack amounts are in KOBO (NGN) — multiply naira × 100
// For USD we store kobo-equivalent but Paystack Nigeria settles everything in NGN.
// USD plans are for reference only; actual USD billing goes through Lemonsqueezy.

const PLANS = [
  // ── B2C NGN ──────────────────────────────────────────────────────────────
  { key: 'ngn_free',            name: 'Free',                    interval: 'monthly',  amount: 0,          currency: 'NGN', description: 'Ascentor Free plan' },
  { key: 'ngn_builder_monthly', name: 'Builder Monthly (₦)',     interval: 'monthly',  amount: 1200000,    currency: 'NGN', description: 'Ascentor Builder — billed monthly' },
  { key: 'ngn_builder_annual',  name: 'Builder Annual (₦)',      interval: 'annually', amount: 11520000,   currency: 'NGN', description: 'Ascentor Builder — billed annually (save ₦28,800)' },
  { key: 'ngn_pro_monthly',     name: 'Pro Monthly (₦)',         interval: 'monthly',  amount: 2500000,    currency: 'NGN', description: 'Ascentor Pro — billed monthly' },
  { key: 'ngn_pro_annual',      name: 'Pro Annual (₦)',          interval: 'annually', amount: 24000000,   currency: 'NGN', description: 'Ascentor Pro — billed annually (save ₦60,000)' },
  { key: 'ngn_elite_monthly',   name: 'Elite Monthly (₦)',       interval: 'monthly',  amount: 6000000,    currency: 'NGN', description: 'Ascentor Elite — billed monthly' },
  { key: 'ngn_elite_annual',    name: 'Elite Annual (₦)',        interval: 'annually', amount: 57600000,   currency: 'NGN', description: 'Ascentor Elite — billed annually (save ₦144,000)' },

  // ── B2B NGN (partners pay in NGN too — USD B2B goes via Lemonsqueezy) ──
  { key: 'ngn_b2b_studio_monthly',  name: 'Partner Studio Monthly',  interval: 'monthly',  amount: 22350000,  currency: 'NGN', description: 'Ascentor Partner Studio — monthly flat fee (~$149)' },
  { key: 'ngn_b2b_studio_annual',   name: 'Partner Studio Annual',   interval: 'annually', amount: 228000000, currency: 'NGN', description: 'Ascentor Partner Studio — annual flat fee (~$1,520)' },
  { key: 'ngn_b2b_academy_monthly', name: 'Partner Academy Monthly', interval: 'monthly',  amount: 74850000,  currency: 'NGN', description: 'Ascentor Partner Academy — monthly flat fee (~$499)' },
  { key: 'ngn_b2b_academy_annual',  name: 'Partner Academy Annual',  interval: 'annually', amount: 763500000, currency: 'NGN', description: 'Ascentor Partner Academy — annual flat fee (~$5,090)' },
] as const

type Plan = typeof PLANS[number]

interface PaystackPlan {
  plan_code: string
  name: string
  amount: number
  interval: string
}

async function fetchExistingPlans(): Promise<PaystackPlan[]> {
  const res = await fetch('https://api.paystack.co/plan?perPage=100', {
    headers: { Authorization: `Bearer ${SECRET}` },
  })
  const json = await res.json()
  return json.data ?? []
}

async function createPlan(plan: Plan): Promise<string> {
  const res = await fetch('https://api.paystack.co/plan', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: plan.name,
      interval: plan.interval,
      amount: plan.amount,
      currency: plan.currency,
      description: plan.description,
    }),
  })
  const json = await res.json()
  if (!json.status) throw new Error(`Failed to create plan "${plan.name}": ${json.message}`)
  return json.data.plan_code as string
}

async function main() {
  console.log('🔍  Fetching existing Paystack plans…')
  const existing = await fetchExistingPlans()
  const existingByName = new Map(existing.map(p => [p.name, p.plan_code]))

  const results: Record<string, string> = {}

  for (const plan of PLANS) {
    if (plan.amount === 0) {
      // Free plan — no Paystack plan needed, just skip
      results[plan.key] = ''
      console.log(`⏭   Skipping Free plan (no Paystack plan needed)`)
      continue
    }

    if (existingByName.has(plan.name)) {
      const code = existingByName.get(plan.name)!
      results[plan.key] = code
      console.log(`✅  Already exists: ${plan.name} → ${code}`)
    } else {
      const code = await createPlan(plan)
      results[plan.key] = code
      console.log(`✨  Created: ${plan.name} → ${code}`)
    }
  }

  console.log('\n──────────────────────────────────────────────────────────')
  console.log('📋  Copy these plan codes into app/pricing/data.ts:')
  console.log('──────────────────────────────────────────────────────────\n')

  // Print as a ready-to-paste TypeScript object
  console.log(`// Paste inside B2C_TIERS in data.ts`)
  console.log(`// ─── NGN plan codes ───`)
  console.log(`paystackPlanCode: {`)
  console.log(`  builder: { monthly: '${results.ngn_builder_monthly}', annual: '${results.ngn_builder_annual}' },`)
  console.log(`  pro:     { monthly: '${results.ngn_pro_monthly}',     annual: '${results.ngn_pro_annual}' },`)
  console.log(`  elite:   { monthly: '${results.ngn_elite_monthly}',   annual: '${results.ngn_elite_annual}' },`)
  console.log(`}`)
  console.log(``)
  console.log(`// ─── B2B plan codes ───`)
  console.log(`paystackPlanCode: {`)
  console.log(`  studio:  { monthly: '${results.ngn_b2b_studio_monthly}',  annual: '${results.ngn_b2b_studio_annual}' },`)
  console.log(`  academy: { monthly: '${results.ngn_b2b_academy_monthly}', annual: '${results.ngn_b2b_academy_annual}' },`)
  console.log(`}`)

  console.log('\n──────────────────────────────────────────────────────────')
  console.log('✅  Done. USD plans are handled by Lemonsqueezy (see data.ts).')
  console.log('──────────────────────────────────────────────────────────\n')
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
