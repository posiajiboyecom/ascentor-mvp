// ============================================================
// FILE LOCATION: types/partner.ts
//
// BUGS FIXED:
//   BUG-05 - PartnerFeatures was missing the 'referrals' field.
//             apply/route.ts inserts { referrals: true } but the
//             type had no such field, causing TS errors in strict
//             mode and the flag being silently ignored everywhere.
//
//   BUG-06 - PartnerBrand was missing the 'border_color' field.
//             getPartnerContext.ts, brand/route.ts and the DEFAULT_BRAND
//             constant all use border_color, but the type didn't
//             declare it - TypeScript strict mode threw errors on
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
  ai_coach:   boolean;
  community:  boolean;
  experts:    boolean;
  courses:    boolean;
  referrals:  boolean;   // FIX BUG-05: was missing; apply/route.ts inserts this field
  own_courses: boolean;  // partner can create their own courses
  own_events:  boolean;  // partner can schedule their own expert events
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
  brand:                    PartnerBrand;
  features:                 PartnerFeatures;
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
