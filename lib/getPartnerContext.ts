// ============================================================
// lib/getPartnerContext.ts
//
// Resolves a hostname → PartnerContext for white-label pages.
//
// Resolution order:
//   1. Custom domain  (coaching.johnadeyemi.com)
//   2. *.ascentorbi.com subdomain  (john.ascentorbi.com)
//   3. "demo" slug fallback — returns Ascentor default brand
//      so demo.ascentorbi.com always works without a DB row
//
// Results are cached in-memory (per deployment) for 60s
// to avoid a DB hit on every page render.
// Call clearPartnerCache(hostname) after brand updates.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { PartnerContext, ASCENTOR_BRAND, Partner } from '@/types/partner';

// ── In-memory cache ───────────────────────────────────────
interface CacheEntry {
  context: PartnerContext;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function clearPartnerCache(hostname: string) {
  cache.delete(normaliseHost(hostname));
}

function normaliseHost(hostname: string): string {
  // Strip port (useful in local dev: localhost:3000)
  return hostname.split(':')[0].toLowerCase();
}

// ── Demo / fallback context (no DB required) ──────────────
const DEMO_CONTEXT: PartnerContext = {
  isWhiteLabel: true,
  cssVars: buildCssVars(ASCENTOR_BRAND),
  partner: {
    id: 'demo',
    slug: 'demo',
    name: 'Ascentor Demo',
    owner_id: '',
    status: 'active',
    brand: ASCENTOR_BRAND,
    paystack_subaccount_code: null,
    revenue_share_percent: 0,
    custom_domain: null,
    subdomain: 'demo',
    plan_overrides: null,
    features: {
      ai_coach:   true,
      community:  true,
      experts:    true,
      courses:    true,
      referrals:  true,
    },
    created_at: '',
    updated_at: '',
    onboarded_at: null,
  },
};

// ── Main export ───────────────────────────────────────────
export async function getPartnerContext(hostname: string): Promise<PartnerContext> {
  const host = normaliseHost(hostname);

  // 1. Check cache
  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  // 2. Extract subdomain from *.ascentorbi.com
  const ROOT_DOMAIN = 'ascentorbi.com';
  let subdomain: string | null = null;

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    subdomain = host.slice(0, -(ROOT_DOMAIN.length + 1));
  }

  // 3. Demo subdomain — return immediately without a DB hit
  if (subdomain === 'demo' || host === 'demo' || host === 'localhost') {
    cache.set(host, { context: DEMO_CONTEXT, expiresAt: Date.now() + CACHE_TTL_MS });
    return DEMO_CONTEXT;
  }

  // 4. Main ascentorbi.com — not a white-label
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    const ctx: PartnerContext = { isWhiteLabel: false, partner: {} as Partner, cssVars: {} };
    cache.set(host, { context: ctx, expiresAt: Date.now() + CACHE_TTL_MS });
    return ctx;
  }

  // 5. Look up partner in DB
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Match on custom_domain first, then subdomain
    const { data: partner } = await supabase
      .from('partners')
      .select('*')
      .or(`custom_domain.eq.${host},subdomain.eq.${subdomain ?? ''}`)
      .eq('status', 'active')
      .single();

    if (!partner) {
      // Unknown host — not a white-label, fall through to 404 in layout
      const ctx: PartnerContext = { isWhiteLabel: false, partner: {} as Partner, cssVars: {} };
      cache.set(host, { context: ctx, expiresAt: Date.now() + CACHE_TTL_MS });
      return ctx;
    }

    const ctx: PartnerContext = {
      isWhiteLabel: true,
      partner: partner as Partner,
      cssVars: buildCssVars(partner.brand),
    };

    cache.set(host, { context: ctx, expiresAt: Date.now() + CACHE_TTL_MS });
    return ctx;

  } catch (err) {
    console.error('[getPartnerContext] DB error:', err);
    // On DB failure, fall back to demo brand so page still renders
    return DEMO_CONTEXT;
  }
}

// ── CSS var builder ───────────────────────────────────────
function buildCssVars(brand: typeof ASCENTOR_BRAND): Record<string, string> {
  return {
    '--accent':       brand.primary_color,
    '--accent-2':     brand.accent_color,
    '--text':         brand.text_color,
    '--bg':           brand.bg_color,
    '--bg-card':      brand.card_color,
    '--bg-input':     brand.card_color,
    '--border':       `${brand.primary_color}28`,   // 16% opacity
    '--font-heading': `'${brand.font_heading}', Georgia, serif`,
    '--font-body':    `'${brand.font_body}', system-ui, sans-serif`,
  };
}
