// ============================================================
// PARTNER PROVIDER — components/partner/PartnerProvider.tsx
//
// React context that makes partner brand available to
// ALL client components without prop drilling.
//
// Usage in any client component:
//   const { partner, brand, isWhiteLabel } = usePartner();
// ============================================================

'use client';

import { createContext, useContext, ReactNode } from 'react';
import { PartnerContext, PartnerBrand } from '@/types/partner';

const PartnerCtx = createContext<PartnerContext | null>(null);

export function PartnerProvider({
  context,
  children,
}: {
  context: PartnerContext;
  children: ReactNode;
}) {
  return <PartnerCtx.Provider value={context}>{children}</PartnerCtx.Provider>;
}

export function usePartner(): PartnerContext & { brand: PartnerBrand } {
  const ctx = useContext(PartnerCtx);
  if (!ctx) {
    // Graceful fallback — on main Ascentor domain, return defaults
    return {
      partner: {} as any,
      isWhiteLabel: false,
      cssVars: {},
      brand: {
        logo_url: '/ascentor-color-for-dark-pages.svg',
        logo_dark_url: null,
        favicon_url: null,
        primary_color: '#E8A020',
        accent_color: '#C8851A',
        text_color: '#D4CFC3',
        bg_color: '#0C0B08',
        card_color: '#141310',
        font_heading: 'Cormorant Garamond',
        font_body: 'Syne',
        hide_ascentor_branding: false,
        platform_name: 'Ascentor',
        tagline: null,
      },
    };
  }
  return { ...ctx, brand: ctx.partner.brand };
}

// ── Convenience components ────────────────────────────────

/** Renders partner logo or falls back to platform name text */
export function PartnerLogo({
  className,
  height = 32,
}: {
  className?: string;
  height?: number;
}) {
  const { brand } = usePartner();

  if (brand.logo_url) {
    return (
      <img
        src={brand.logo_url}
        alt={brand.platform_name}
        style={{ height, width: 'auto' }}
        className={className}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        fontFamily: `var(--font-heading)`,
        fontSize: height * 0.7,
        fontWeight: 700,
        color: 'var(--accent)',
      }}
    >
      {brand.platform_name}
    </span>
  );
}

/** Renders "Powered by Ascentor" footer — hidden if partner opts out */
export function PoweredByAscentor() {
  const { brand, isWhiteLabel } = usePartner();
  if (!isWhiteLabel || brand.hide_ascentor_branding) return null;

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-body)',
      }}
    >
      Powered by{' '}
      <a
        href="https://ascentorbi.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#E8A020', textDecoration: 'none' }}
      >
        Ascentor
      </a>
    </div>
  );
}

/** Replaces any hardcoded "Ascentor" string with partner platform name */
export function PlatformName() {
  const { brand } = usePartner();
  return <>{brand.platform_name}</>;
}
