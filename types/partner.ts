// ============================================================
// types/partner.ts
// Shared type definitions for the partner/white-label system.
// Used by getPartnerContext, PartnerCheckoutClient, and all
// partner API routes and page components.
// ============================================================

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
  font_heading:           string;
  font_body:              string;
  hide_ascentor_branding: boolean;
}

export interface PartnerFeatures {
  ai_coach:  boolean;
  community: boolean;
  experts:   boolean;
  courses:   boolean;
}

export interface PartnerPlanOverrides {
  explorer_name?:      string;
  explorer_price_usd?: number;
  builder_name?:       string;
  builder_price_usd?:  number;
  climber_name?:       string;
  climber_price_usd?:  number;
}

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
  brand:                    PartnerBrand;
  features:                 PartnerFeatures;
  plan_overrides:           PartnerPlanOverrides | null;
  created_at:               string;
  updated_at:               string;
  onboarded_at:             string | null;
}

export interface PartnerContext {
  isWhiteLabel: boolean;
  partner:      Partner;
  cssVars:      Record<string, string>;
}
