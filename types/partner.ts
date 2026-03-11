// ============================================================
// types/partner.ts
// Single source of truth for all partner/white-label types.
// Consumed by:
//   - lib/getPartnerContext.ts
//   - components/partner/PartnerProvider.tsx
//   - app/p/[subdomain]/checkout/PartnerCheckoutClient.tsx
//   - app/api/partner/brand/route.ts
//   - app/partner/brand/page.tsx
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
  [key: string]:       string | number | undefined; // allow arbitrary overrides
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
