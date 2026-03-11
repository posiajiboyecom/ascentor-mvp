// ============================================================
// PARTNER CONTEXT — lib/partner/getPartnerContext.ts
//
// Called server-side on every request to resolve:
//   subdomain → partner record → brand CSS vars
//
// Works for:
//   - john.ascentorbi.com        → slug = "john"
//   - coaching.johnadeyemi.com   → custom_domain lookup
//   - ascentorbi.com             → returns Ascentor defaults
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { Partner, PartnerBrand, PartnerContext, ASCENTOR_BRAND } from '@/types/partner';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAIN_DOMAIN = 'ascentorbi.com';

// Cache partner lookups in memory for 5 minutes (per cold start)
// In production, use Redis/Upstash via Trigger.dev
const cache = new Map<string, { data: PartnerContext; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPartnerContext(hostname: string): Promise<PartnerContext> {
  // Strip port for local dev
  const host = hostname.split(':')[0];

  // Check cache
  const cached = cache.get(host);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  let partner: Partner | null = null;

  // ── 1. Check if custom domain (not *.ascentorbi.com) ──────
  if (!host.endsWith(MAIN_DOMAIN) && host !== MAIN_DOMAIN) {
    const { data } = await supabase
      .from('partners')
      .select('*')
      .eq('custom_domain', host)
      .eq('status', 'active')
      .single();
    partner = data;
  }

  // ── 2. Check if subdomain of ascentorbi.com ───────────────
  if (!partner && host.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = host.replace(`.${MAIN_DOMAIN}`, '');
    // Ignore www and app
    if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
      const { data } = await supabase
        .from('partners')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('status', 'active')
        .single();
      partner = data;
    }
  }

  // ── 3. Build context ──────────────────────────────────────
  const ctx: PartnerContext = partner
    ? {
        partner,
        isWhiteLabel: true,
        cssVars: brandToCssVars(partner.brand),
      }
    : {
        partner: buildAscentorPartner(),
        isWhiteLabel: false,
        cssVars: brandToCssVars(ASCENTOR_BRAND),
      };

  // Cache it
  cache.set(host, { data: ctx, expires: Date.now() + CACHE_TTL });

  return ctx;
}

// ── Clear cache for a partner (call after brand update) ───
export function clearPartnerCache(host: string) {
  cache.delete(host);
}

// ── Convert brand colours to CSS variables ────────────────
// These map to your existing --accent, --bg, etc. pattern
export function brandToCssVars(brand: PartnerBrand): Record<string, string> {
  return {
    '--accent':      brand.primary_color,
    '--accent-dim':  brand.accent_color,
    '--bg':          brand.bg_color,
    '--bg-card':     brand.card_color,
    '--bg-input':    adjustBrightness(brand.card_color, 10),
    '--text':        brand.text_color,
    '--text-muted':  adjustBrightness(brand.text_color, -30),
    '--text-dim':    adjustBrightness(brand.text_color, -60),
    '--border':      `${brand.primary_color}22`,
    '--font-heading': `'${brand.font_heading}', Georgia, serif`,
    '--font-body':    `'${brand.font_body}', sans-serif`,
  };
}

// ── Simple brightness adjustment for derived colours ──────
function adjustBrightness(hex: string, amount: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

// ── Ascentor's own "partner" record (for uniform interface) ─
function buildAscentorPartner(): Partner {
  return {
    id: 'ascentor',
    slug: 'ascentor',
    name: 'Ascentor',
    owner_id: '',
    status: 'active',
    brand: ASCENTOR_BRAND,
    paystack_subaccount_code: null,
    revenue_share_percent: 100,
    custom_domain: null,
    subdomain: '',
    plan_overrides: null,
    features: {
      ai_coach: true,
      community: true,
      experts: true,
      courses: true,
      referrals: true,
    },
    created_at: '',
    updated_at: '',
    onboarded_at: '',
  };
}
