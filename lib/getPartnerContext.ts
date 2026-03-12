// ============================================================
// lib/getPartnerContext.ts
//
// FILE LOCATION: lib/getPartnerContext.ts
//
// FIXES:
//   W-04 — buildCssVars now reads brand.border_color when set and
//           uses it directly as --border, rather than computing
//           rgba(text_color, 10%) which gave wrong results in preview.
//           Falls back to the rgba calculation only if border_color
//           is not set (backwards-compatible with existing partners).
//
//   W-21 — --bg-input was adjustBrightness(card_color, +8), which on
//           default dark card (#141310) produced #1C1A13 — nearly
//           identical to the card background. Text inputs were
//           invisible. Changed to minimum +22 so the input bg is
//           always perceptibly lighter than the card.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { Partner, PartnerBrand, PartnerContext } from '@/types/partner';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '@/lib/partnerCache';

export type { Partner, PartnerBrand, PartnerContext };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Cache key prefix ──────────────────────────────────────

const CACHE_PREFIX = 'pctx:';

function cacheKey(host: string): string {
  return `${CACHE_PREFIX}${host}`;
}

export async function clearPartnerCache(subdomain?: string): Promise<void> {
  if (subdomain) {
    await cacheDelPattern(subdomain);
  } else {
    await cacheDelPattern(CACHE_PREFIX);
  }
}

// ── Default brand fallback ────────────────────────────────

const DEFAULT_BRAND: PartnerBrand = {
  platform_name:          'Partner Platform',
  tagline:                null,
  logo_url:               null,
  logo_dark_url:          null,
  favicon_url:            null,
  primary_color:          '#E8A020',
  accent_color:           '#C87820',
  text_color:             '#D4CFC3',
  bg_color:               '#0C0B08',
  card_color:             '#1E1C17',
  border_color:           '#2A2720',  // FIX W-04: explicit border default
  font_heading:           'Cormorant Garamond',
  font_body:              'Syne',
  hide_ascentor_branding: false,
};

// ── CSS var builder ───────────────────────────────────────

function buildCssVars(brand: PartnerBrand): Record<string, string> {
  // FIX W-04: use explicit border_color when set; fallback to rgba computation
  const borderValue = brand.border_color
    ? brand.border_color
    : `rgba(${hexToRgb(brand.text_color)}, 0.10)`;

  return {
    '--bg':           brand.bg_color,
    '--bg-card':      brand.card_color,
    // FIX W-21: minimum +22 brightness so inputs are always visible against card bg
    '--bg-input':     adjustBrightness(brand.card_color, 22),
    '--text':         brand.text_color,
    '--text-muted':   adjustBrightness(brand.text_color, -30),
    '--text-dim':     adjustBrightness(brand.text_color, -50),
    '--accent':       brand.primary_color,
    '--accent-hover': brand.accent_color,
    '--border':       borderValue,
    '--font-heading': `'${brand.font_heading}', Georgia, serif`,
    '--font-body':    `'${brand.font_body}', system-ui, sans-serif`,
    '--success':      '#10B981',
    '--error':        '#EF4444',
  };
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '212, 207, 195';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function adjustBrightness(hex: string, amount: number): string {
  try {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    const r = Math.min(255, Math.max(0, parseInt(result[1], 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(result[2], 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(result[3], 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return hex;
  }
}

// ── Main function ─────────────────────────────────────────

export async function getPartnerContext(hostname: string): Promise<PartnerContext> {
  // Strip port for local dev
  const host = hostname.replace(/:\d+$/, '');

  // Check distributed cache
  const cached = await cacheGet(cacheKey(host));
  if (cached) {
    try {
      return JSON.parse(cached) as PartnerContext;
    } catch {
      // Corrupted cache entry — ignore and re-fetch
    }
  }

  // Extract subdomain from *.ascentorbi.com
  const subdomainMatch = host.match(/^([^.]+)\.ascentorbi\.com$/);
  const subdomain = subdomainMatch?.[1];

  // Skip non-partner hosts
  const isMainDomain = host === 'ascentorbi.com' || host === 'www.ascentorbi.com' || host === 'localhost';

  let partner: Partner | null = null;

  if (!isMainDomain) {
    // Try subdomain first, then custom domain
    const { data } = await supabase
      .from('partners')
      .select(`
        id, name, slug, subdomain, custom_domain, status, owner_id,
        revenue_share_percent, paystack_subaccount_code,
        brand, features, plan_overrides,
        created_at, updated_at, onboarded_at
      `)
      .or(
        subdomain
          ? `subdomain.eq.${subdomain},custom_domain.eq.${host}`
          : `custom_domain.eq.${host}`
      )
      .eq('status', 'active')
      .single();

    partner = data as Partner | null;
  }

  if (!partner) {
    const ctx: PartnerContext = {
      isWhiteLabel: false,
      partner: {
        id: '', name: '', slug: '', subdomain: '', custom_domain: null,
        status: 'pending' as const, owner_id: '',
        revenue_share_percent: 0,
        paystack_subaccount_code: null,
        brand: DEFAULT_BRAND,
        features: { ai_coach: true, community: true, experts: true, courses: true },
        plan_overrides: null,
        created_at: '', updated_at: '', onboarded_at: null,
      },
      cssVars: buildCssVars(DEFAULT_BRAND),
    };
    return ctx;
  }

  // Merge brand with defaults for missing fields
  const brand: PartnerBrand = { ...DEFAULT_BRAND, ...(partner.brand || {}) };

  const ctx: PartnerContext = {
    isWhiteLabel: true,
    partner: { ...partner, brand },
    cssVars: buildCssVars(brand),
  };

  await cacheSet(cacheKey(host), JSON.stringify(ctx));
  return ctx;
}
