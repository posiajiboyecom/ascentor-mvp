// ═══════════════════════════════════════════════════════════
// Ascentor branding palette — matches VideoDrawer.tsx exactly
// ═══════════════════════════════════════════════════════════
export const PALETTE = {
  amber:       '#A0720A',
  amberBright: '#E8A020',
  amberGlow:   'rgba(232,160,32,0.14)',
  dark:        '#0C0B08',
  darkSoft:    '#1A1814',
  warm:        '#F5F3EE',
  warmSoft:    '#FDFCF9',
  muted:       '#6B6860',
  faint:       '#9E9B94',
  border:      '#E2DDD4',
} as const;

export const FONT_DISPLAY = '"Canela", "Playfair Display", Georgia, serif';
export const FONT_MONO = '"DM Mono", "IBM Plex Mono", ui-monospace, monospace';
export const FONT_BODY = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';

export function themeColors(theme: 'dark' | 'light') {
  return theme === 'dark'
    ? {
        bg:        PALETTE.dark,
        bgSoft:    PALETTE.darkSoft,
        text:      PALETTE.warm,
        textMuted: 'rgba(245,243,238,0.60)',
        textFaint: 'rgba(245,243,238,0.35)',
        accent:    PALETTE.amberBright,
        accentSoft:PALETTE.amberGlow,
        rail:      'rgba(232,160,32,0.18)',
        divider:   'rgba(245,243,238,0.08)',
      }
    : {
        bg:        PALETTE.warmSoft,
        bgSoft:    PALETTE.warm,
        text:      PALETTE.dark,
        textMuted: PALETTE.muted,
        textFaint: PALETTE.faint,
        accent:    PALETTE.amber,
        accentSoft:'rgba(160,114,10,0.08)',
        rail:      'rgba(160,114,10,0.18)',
        divider:   PALETTE.border,
      };
}

// Map SceneEmphasis → styling overrides
export function emphasisStyle(emphasis: 'normal' | 'bold' | 'accent' | 'whisper', accent: string, text: string): React.CSSProperties {
  switch (emphasis) {
    case 'bold':
      return { fontWeight: 700, color: text };
    case 'accent':
      return { fontWeight: 700, color: accent, letterSpacing: '-0.01em' };
    case 'whisper':
      return { fontWeight: 300, color: 'currentColor', opacity: 0.55, fontStyle: 'italic' };
    case 'normal':
    default:
      return { fontWeight: 500, color: text };
  }
}
