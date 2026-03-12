// ============================================================
// FILE LOCATION: types/partner.ts
//
// BUGS FIXED:
//   BUG-05 — PartnerFeatures was missing the 'referrals' field.
//             apply/route.ts inserts { referrals: true } but the
//             type had no such field, causing TS errors in strict
//             mode and the flag being silently ignored everywhere.
//
//   BUG-06 — PartnerBrand was missing the 'border_color' field.
//             getPartnerContext.ts, brand/route.ts and the DEFAULT_BRAND
//             constant all use border_color, but the type didn't
//             declare it — TypeScript strict mode threw errors on
//             every read/write of that property.
// ============================================================

// ── Font options (matches allowed list in brand/route.ts) ──
export type FontOption =
  | 'Cormorant Garamond'
  | 'Playfair Display'
  | 'Merriweather'
  | 'Syne'
  | 'Inter'
  | 'DM Sans';

// ── Brand ─────────────────────────────────────────────────
export interface PartnerBrand {
  platform_name:          string;
  tagline:                string | null;
  logo_url:               string | null;
  logo_dark_url:          string | null;
  favicon_url:            string | null;
  primary_color:          string;
  accent_color:           string;
  text_color:             string;
  bg_color:               string;
  card_color:             string;
  border_color?:          string;        // FIX BUG-06: was missing; used by getPartnerContext + brand/route
  font_heading:           FontOption | string;
  font_body:              FontOption | string;
  hide_ascentor_branding: boolean;
}

// ── Features ──────────────────────────────────────────────
export interface PartnerFeatures {
  ai_coach:  boolean;
  community: boolean;
  experts:   boolean;
  courses:   boolean;
  referrals: boolean;   // FIX BUG-05: was missing; apply/route.ts inserts this field
}

// ── Plan overrides ────────────────────────────────────────
export interface PartnerPlanOverrides {
  explorer_name?:      string;
  explorer_price_usd?: number;
  builder_name?:       string;
  builder_price_usd?:  number;
  climber_name?:       string;
  climber_price_usd?:  number;
  trial_days?:         number;
  [key: string]:       string | number | undefined;
}

// ── Partner ───────────────────────────────────────────────
export interface Partner {
  id:                       string;
  name:                     string;
  slug:                     string;
  subdomain:                string;
  custom_domain:            string | null;
  status:                   'pending' | 'active' | 'suspended' | 'rejected';
  owner_id:                 string;
  revenue_share_percent:    number;
  paystack_subaccount_code: string | null;
  paystack_secret_key?:     string | null;   // present on GET brand response as boolean flag only
  brand:                    PartnerBrand;
  features:                 PartnerFeatures;
  plan_overrides:           PartnerPlanOverrides | null;
  plan_tier?:               'standard' | 'pro' | null;
  created_at:               string;
  updated_at:               string;
  onboarded_at:             string | null;
}

// ── Context (returned by getPartnerContext) ───────────────
export interface PartnerContext {
  isWhiteLabel: boolean;
  partner:      Partner;
  cssVars:      Record<string, string>;
}
