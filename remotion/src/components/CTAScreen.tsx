// ═══════════════════════════════════════════════════════════
// CTA screen — 6 template variants. Rendered at the tail of
// the video as a <Sequence> child. Entry motion eases in from
// the last narrative scene's fade-out.
//
// Templates:
//   dark-centered    — centered headline + subtitle + amber button on dark
//   image-top        — image on top (square-ish), headline + button below
//   split            — 50/50 image | text split, vertical-friendly
//   light-centered   — same as dark-centered but on warm background
//   fullbg-branded   — bold amber headline on deep dark bg, white button
//   minimal-link     — echoes closing line + plain URL text, no button
// ═══════════════════════════════════════════════════════════
import {
  AbsoluteFill, Img, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { PALETTE, FONT_DISPLAY, FONT_MONO, themeColors } from '../utils/palette';
import { easeOutCubic } from '../utils/motion';
import type { CTAScreen as CTAScreenType } from '../../../types/video';

interface Props {
  cta:   CTAScreenType;
  theme: 'dark' | 'light';
  logoUrl: string;
}

export const CTAScreen: React.FC<Props> = ({ cta, theme, logoUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = themeColors(theme);

  // Entry over first 22 frames (~0.73s)
  const t = Math.max(0, Math.min(1, frame / 22));
  const eased = easeOutCubic(t);

  const commonContainer: React.CSSProperties = {
    opacity: eased,
    transform: `translateY(${(1 - eased) * 32}px)`,
  };

  // ── Shared atoms ──────────────────────────────────────────
  const Headline = ({ text, color, size = 92 }: { text: string; color: string; size?: number }) => (
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: size,
        lineHeight: 1.08,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color,
        textAlign: 'center',
        maxWidth: '90%',
      }}
    >
      {text}
    </div>
  );

  const Subtitle = ({ text, color }: { text: string; color: string }) => (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 28,
        lineHeight: 1.5,
        color,
        textAlign: 'center',
        maxWidth: '80%',
      }}
    >
      {text}
    </div>
  );

  const Button = ({ text, bg, fg }: { text: string; bg: string; fg: string }) => {
    // Button pulses gently in sync with breathing
    const pulse = 1 + Math.sin((frame / fps) * 2.2) * 0.015;
    return (
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 30,
          fontWeight: 700,
          padding: '22px 48px',
          borderRadius: 10,
          background: bg,
          color: fg,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          transform: `scale(${pulse})`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.25)`,
          minWidth: 320,
          textAlign: 'center',
        }}
      >
        {text}
      </div>
    );
  };

  const UrlDisplay = ({ url, color }: { url: string; color: string }) => {
    // Strip protocol for cleaner display
    const clean = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return (
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 34,
          color,
          borderBottom: `2px solid ${color}`,
          paddingBottom: 10,
        }}
      >
        {clean}
      </div>
    );
  };

  const CtaLogoFooter = ({ url, theme }: { url: string; theme: 'dark' | 'light' }) => {
    if (!url) return null;
    return (
      <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <Img src={url} style={{ height: 34, opacity: theme === 'dark' ? 0.75 : 0.65 }} />
      </div>
    );
  };

  // ── Template renderers ───────────────────────────────────
  switch (cta.template) {
    case 'dark-centered':
      return (
        <AbsoluteFill style={{ background: PALETTE.dark }}>
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, rgba(232,160,32,0.12), transparent 60%)` }} />
          <AbsoluteFill
            style={{
              ...commonContainer,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 48,
              padding: '0 60px',
            }}
          >
            <Headline text={cta.headlineText} color={PALETTE.warm} />
            {cta.subtitleText && <Subtitle text={cta.subtitleText} color="rgba(245,243,238,0.7)" />}
            <Button text={cta.buttonText} bg={PALETTE.amberBright} fg={PALETTE.dark} />
          </AbsoluteFill>
          <CtaLogoFooter url={logoUrl} theme="dark" />
        </AbsoluteFill>
      );

    case 'light-centered':
      return (
        <AbsoluteFill style={{ background: PALETTE.warmSoft }}>
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, rgba(160,114,10,0.10), transparent 60%)` }} />
          <AbsoluteFill
            style={{
              ...commonContainer,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 48,
              padding: '0 60px',
            }}
          >
            <Headline text={cta.headlineText} color={PALETTE.dark} />
            {cta.subtitleText && <Subtitle text={cta.subtitleText} color={PALETTE.muted} />}
            <Button text={cta.buttonText} bg={PALETTE.amber} fg={PALETTE.warmSoft} />
          </AbsoluteFill>
          <CtaLogoFooter url={logoUrl} theme="light" />
        </AbsoluteFill>
      );

    case 'image-top':
      return (
        <AbsoluteFill style={{ background: theme === 'dark' ? PALETTE.dark : PALETTE.warmSoft }}>
          <AbsoluteFill
            style={{
              ...commonContainer,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 40,
              padding: '0 60px',
            }}
          >
            {cta.imageUrl && (
              <div style={{
                width: 720, height: 480, borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              }}>
                <Img src={cta.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <Headline text={cta.headlineText} color={c.text} size={72} />
            <Button
              text={cta.buttonText}
              bg={c.accent}
              fg={theme === 'dark' ? PALETTE.dark : PALETTE.warmSoft}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'split':
      return (
        <AbsoluteFill style={{ background: theme === 'dark' ? PALETTE.dark : PALETTE.warmSoft, flexDirection: 'column' }}>
          {cta.imageUrl && (
            <div style={{ flex: 1, overflow: 'hidden', opacity: eased }}>
              <Img src={cta.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div
            style={{
              ...commonContainer,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 36,
              padding: '0 60px',
            }}
          >
            <Headline text={cta.headlineText} color={c.text} size={80} />
            {cta.subtitleText && <Subtitle text={cta.subtitleText} color={c.textMuted} />}
            <Button
              text={cta.buttonText}
              bg={c.accent}
              fg={theme === 'dark' ? PALETTE.dark : PALETTE.warmSoft}
            />
          </div>
        </AbsoluteFill>
      );

    case 'fullbg-branded':
      return (
        <AbsoluteFill style={{ background: PALETTE.dark }}>
          <AbsoluteFill style={{ background: `linear-gradient(135deg, rgba(160,114,10,0.18) 0%, rgba(12,11,8,0) 70%)` }} />
          <AbsoluteFill
            style={{
              ...commonContainer,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 56,
              padding: '0 60px',
            }}
          >
            <Headline text={cta.headlineText} color={PALETTE.amberBright} size={108} />
            {cta.subtitleText && <Subtitle text={cta.subtitleText} color="rgba(245,243,238,0.7)" />}
            <Button text={cta.buttonText} bg={PALETTE.warm} fg={PALETTE.dark} />
          </AbsoluteFill>
          <CtaLogoFooter url={logoUrl} theme="dark" />
        </AbsoluteFill>
      );

    case 'minimal-link':
      return (
        <AbsoluteFill style={{ background: theme === 'dark' ? PALETTE.dark : PALETTE.warmSoft }}>
          <AbsoluteFill
            style={{
              ...commonContainer,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 60,
              padding: '0 60px',
            }}
          >
            {cta.closingLine && (
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 64,
                  lineHeight: 1.2,
                  color: c.text,
                  textAlign: 'center',
                  maxWidth: '85%',
                  fontStyle: 'italic',
                  fontWeight: 400,
                }}
              >
                "{cta.closingLine}"
              </div>
            )}
            <UrlDisplay url={cta.buttonUrl} color={c.accent} />
          </AbsoluteFill>
          <CtaLogoFooter url={logoUrl} theme={theme} />
        </AbsoluteFill>
      );

    default:
      return null;
  }
};
