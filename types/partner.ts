// ============================================================
// types/partner.ts
//
// FILE LOCATION: types/partner.ts
//
// FIX (W-04):
//   Added optional `border_color` field to PartnerBrand.
//   This field is now used by buildCssVars() in getPartnerContext.ts
//   to set --border directly from the partner's chosen colour,
//   rather than computing it as an alpha on text_color.
//   The brand/page.tsx preview also reads this value directly.
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
  border_color?:          string;   // FIX W-04: explicit partner border colour
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
  paystack_secret_key?:     string | null;
  brand:                    PartnerBrand;
  features:                 PartnerFeatures;
  plan_overrides:           PartnerPlanOverrides | null;
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
