// lib/admin-design/tokens.ts
// ============================================================
// THE LEDGER — token values for JS/TS contexts (charts, canvas,
// conditional inline styles, the theme toggle itself).
//
// These are the canonical hex/value source. styles/admin-ledger.css
// is the canonical CSS custom-property source. If you change a
// color, change it in BOTH files — they intentionally don't
// share a build step so the CSS file can be imported directly
// in app/layout.tsx without a CSS-in-JS pipeline.
//
// Usage:
//   import { ledgerTokens } from '@/lib/admin-design/tokens';
//   <Bar fill={ledgerTokens.dark.gold} />
// ============================================================

export type LedgerTheme = 'dark' | 'light';

export const ledgerFonts = {
  serif: "'Cormorant Garamond', Georgia, serif",
  ui:    "'Syne', system-ui, sans-serif",
  mono:  "'DM Mono', 'JetBrains Mono', monospace",
} as const;

export const ledgerStatus = {
  good:    '#4F8F4F',
  goodBg:  'rgba(79,143,79,0.12)',
  bad:     '#C84A38',
  badBg:   'rgba(200,74,56,0.12)',
  warn:    '#C28A1A',
  warnBg:  'rgba(194,138,26,0.12)',
  info:    '#4D7CC7',
  infoBg:  'rgba(77,124,199,0.12)',
} as const;

export const ledgerGold = {
  gold:      '#C8A96E',
  goldDeep:  '#A8894E',
  goldBg:    'rgba(200,169,110,0.12)',
  goldBorder:'rgba(200,169,110,0.28)',
} as const;

export const ledgerThemes: Record<LedgerTheme, {
  bg: string; bgDeep: string; bgCard: string; bgCardHover: string; bgInput: string;
  ink: string; inkSoft: string; inkFaint: string;
  line: string; lineStrong: string;
  shadow: string;
}> = {
  dark: {
    bg:           '#0F0E0C',
    bgDeep:       '#080807',
    bgCard:       '#17150F',
    bgCardHover:  '#1E1C15',
    bgInput:      '#1E1C15',
    ink:          '#F5F2EA',
    inkSoft:      '#C9C2B2',
    inkFaint:     '#7A7567',
    line:         'rgba(245,242,234,0.10)',
    lineStrong:   'rgba(245,242,234,0.18)',
    shadow:       '0 4px 24px rgba(0,0,0,0.40)',
  },
  light: {
    bg:           '#FAFAF8',
    bgDeep:       '#F2EFE7',
    bgCard:       '#FFFFFF',
    bgCardHover:  '#F6F3EC',
    bgInput:      '#F2EFE7',
    ink:          '#161412',
    inkSoft:      '#4A453C',
    inkFaint:     '#948C7C',
    line:         'rgba(22,20,18,0.10)',
    lineStrong:   'rgba(22,20,18,0.16)',
    shadow:       '0 2px 16px rgba(22,20,18,0.06)',
  },
};

export const ledgerTokens = {
  fonts: ledgerFonts,
  status: ledgerStatus,
  gold: ledgerGold,
  dark: ledgerThemes.dark,
  light: ledgerThemes.light,
};

// Chart palette in priority order — use for any multi-series
// chart (subscription mix, content performance, etc.) so colors
// stay consistent across every page that visualizes data.
export const ledgerChartPalette = [
  ledgerGold.gold,
  ledgerStatus.info,
  ledgerStatus.good,
  ledgerStatus.warn,
  ledgerStatus.bad,
] as const;
