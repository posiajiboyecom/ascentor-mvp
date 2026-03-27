// ═══════════════════════════════════════════════════════════════════════════
// LOCALE DETECTION — drop this into your proxy file
// ═══════════════════════════════════════════════════════════════════════════
//
// HOW TO INTEGRATE:
//
// 1. Find where your proxy reads/modifies the incoming Request or Response
//    headers — typically near the top of the default export function.
//
// 2. Call detectCountry(req) to get the country code.
//
// 3. Set the x-country header on the request so your page components
//    can read it via headers().get('x-country').
//
// The detection order is:
//   a) Vercel's built-in geo header (free, no API call)
//   b) Cloudflare's CF-IPCountry header (if behind CF)
//   c) ipapi.co free-tier API lookup (fallback, rate-limited to 1k/day free)
//   d) 'NG' default (keeps NGN as the safe fallback)
//
// ═══════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'

// ─── Country detection helper ─────────────────────────────────────────────

/**
 * Detects the visitor's country using available signals in priority order.
 * Returns an ISO 3166-1 alpha-2 country code (e.g. 'NG', 'US', 'GB').
 * Falls back to 'NG' (Nigeria) so NGN pricing is always the safe default.
 */
export async function detectCountry(req: NextRequest): Promise<string> {
  // 1. Vercel geo (populated automatically on Vercel deployments)
  //    Access via request.geo in Next.js 13+ App Router
  const vercelCountry = (req as NextRequest & { geo?: { country?: string } }).geo?.country
  if (vercelCountry) return vercelCountry

  // 2. Cloudflare CDN header (if you route through Cloudflare)
  const cfCountry = req.headers.get('cf-ipcountry')
  if (cfCountry && cfCountry !== 'XX') return cfCountry

  // 3. Forwarded header — useful in self-hosted / Railway / Render envs
  //    Some providers set x-vercel-ip-country themselves
  const fwdCountry = req.headers.get('x-vercel-ip-country')
  if (fwdCountry) return fwdCountry

  // 4. ipapi.co free lookup — only fires if none of the above worked.
  //    Free tier: 1,000 req/day. Upgrade to $11/mo for 50k/day if needed.
  //    To disable this fallback (e.g. in local dev), set:
  //      DISABLE_IP_GEOLOCATION=true in .env.local
  if (process.env.DISABLE_IP_GEOLOCATION !== 'true') {
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? null

      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const res = await fetch(`https://ipapi.co/${ip}/country/`, {
          headers: { 'User-Agent': 'ascentorbi.com/1.0' },
          // Short timeout — don't let a slow API kill page load
          signal: AbortSignal.timeout(800),
        })
        if (res.ok) {
          const country = (await res.text()).trim()
          if (country.length === 2) return country.toUpperCase()
        }
      }
    } catch {
      // Silently fail — fall through to default
    }
  }

  // 5. Default: Nigeria (keeps NGN as the safe fallback)
  return 'NG'
}

// ─── Currency resolver ────────────────────────────────────────────────────

/**
 * Maps a country code to the correct Ascentor pricing currency.
 * Nigerian users get NGN. Everyone else gets USD.
 */
export function currencyFromCountry(country: string): 'ngn' | 'usd' {
  const NGN_COUNTRIES = new Set(['NG']) // extend if you add more NGN markets
  return NGN_COUNTRIES.has(country.toUpperCase()) ? 'ngn' : 'usd'
}

// ─── HOW TO USE IN YOUR PROXY ─────────────────────────────────────────────
//
// Inside your proxy's request handler, add:
//
//   import { detectCountry, currencyFromCountry } from './localeDetection'
//
//   export default async function proxyHandler(req: NextRequest, ...) {
//
//     // ── INSERT: locale detection ──────────────────────────────────
//     const country = await detectCountry(req)
//     const currency = currencyFromCountry(country)
//
//     // Clone the request and attach headers for downstream pages
//     const requestHeaders = new Headers(req.headers)
//     requestHeaders.set('x-country', country)
//     requestHeaders.set('x-currency', currency)   // 'ngn' or 'usd'
//
//     // Then forward the modified request to your target:
//     const response = NextResponse.next({ request: { headers: requestHeaders } })
//     // ── END INSERT ────────────────────────────────────────────────
//
//     // ... rest of your existing proxy logic
//     return response
//   }
//
// ─────────────────────────────────────────────────────────────────────────
// READING THE HEADER IN YOUR PRICING PAGE (server component)
// ─────────────────────────────────────────────────────────────────────────
//
// In app/pricing/page.tsx (server component):
//
//   import { headers } from 'next/headers'
//   import type { Currency } from './data'
//   import PricingClient from './PricingClient'
//
//   export default function PricingPage() {
//     const headersList = headers()
//     const country  = headersList.get('x-country') ?? 'NG'
//     const currency = headersList.get('x-currency') as Currency ?? 'ngn'
//
//     return <PricingClient defaultCurrency={currency} defaultCountry={country} />
//   }
//
// Then in PricingClient.tsx, change:
//   const [currency, setCurrency] = useState<Currency>('ngn')
// to:
//   const [currency, setCurrency] = useState<Currency>(defaultCurrency)
//
// And remove the useEffect timezone heuristic — it's no longer needed.
// ─────────────────────────────────────────────────────────────────────────
