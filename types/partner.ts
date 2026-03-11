// ============================================================
// PARTNER / WHITE-LABEL TYPES
// Central type definitions for the white-label system
// ============================================================

export interface Partner {
  id: string;
  slug: string;                    // subdomain: coach.ascentorbi.com
  name: string;                    // "John Adeyemi Coaching"
  owner_id: string;                // Supabase auth user (the coach)
  status: PartnerStatus;

  // ── Branding ───────────────────────────────────────────────
  brand: PartnerBrand;

  // ── Paystack split ─────────────────────────────────────────
  paystack_subaccount_code: string | null;  // e.g. "ACCT_xxxxxxxx"
  revenue_share_percent: number;            // coach's cut, e.g. 70 (= 70%)

  // ── Config ─────────────────────────────────────────────────
  custom_domain: string | null;    // e.g. "coaching.johnadeyemi.com"
  subdomain: string;               // e.g. "john" → john.ascentorbi.com
  plan_overrides: PlanOverrides | null;
  features: PartnerFeatures;

  // ── Meta ───────────────────────────────────────────────────
  created_at: string;
  updated_at: string;
  onboarded_at: string | null;
}

export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'churned';

export interface PartnerBrand {
  logo_url: string | null;          // uploaded to Supabase storage
  logo_dark_url: string | null;     // optional dark-mode variant
  favicon_url: string | null;
  primary_color: string;            // hex e.g. "#2563EB"
  accent_color: string;             // hex e.g. "#1D4ED8"
  text_color: string;               // hex e.g. "#F8FAFC"
  bg_color: string;                 // hex e.g. "#0F172A"
  card_color: string;               // hex e.g. "#1E293B"
  font_heading: FontOption;
  font_body: FontOption;
  hide_ascentor_branding: boolean;  // "Powered by Ascentor" footer toggle
  platform_name: string;            // replaces "Ascentor" in UI copy
  tagline: string | null;
}

export type FontOption =
  | 'Cormorant Garamond'
  | 'Playfair Display'
  | 'Merriweather'
  | 'Syne'
  | 'Inter'
  | 'DM Sans';

export interface PlanOverrides {
  explorer_price_usd: number | null;
  builder_price_usd: number | null;
  climber_price_usd: number | null;
  explorer_name: string | null;     // rename plans e.g. "Starter"
  builder_name: string | null;
  climber_name: string | null;
  trial_days: number;
}

export interface PartnerFeatures {
  ai_coach: boolean;
  community: boolean;
  experts: boolean;
  courses: boolean;
  referrals: boolean;
}

// ── Partner context injected server-side ──────────────────
// This is what every page receives from getPartnerContext()
export interface PartnerContext {
  partner: Partner;
  isWhiteLabel: boolean;           // false on ascentorbi.com itself
  cssVars: Record<string, string>; // ready to inject as style vars
}

// ── Brand defaults (Ascentor's own) ──────────────────────
export const ASCENTOR_BRAND: PartnerBrand = {
  logo_url: '/ascentor-color-for-dark-pages.svg',
  logo_dark_url: null,
  favicon_url: '/favicon.ico',
  primary_color: '#E8A020',
  accent_color: '#C8851A',
  text_color: '#D4CFC3',
  bg_color: '#0C0B08',
  card_color: '#141310',
  font_heading: 'Cormorant Garamond',
  font_body: 'Syne',
  hide_ascentor_branding: false,
  platform_name: 'Ascentor',
  tagline: 'Everyone who made it had someone.',
};
