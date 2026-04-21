// ═══════════════════════════════════════════════════════════
// CTAOnly Composition — renders a standalone CTA screen
// sized to match whatever the source clip dimensions are.
//
// Drop in: remotion/src/compositions/CTAOnlyComposition.tsx
//
// This reuses the existing CTAScreen component but wraps it
// in a dynamic-size composition so Remotion can render it at
// e.g. 720x1280 (TikTok) or 1280x720 (landscape) rather than
// the fixed 1080x1920 of the kinetic video.
// ═══════════════════════════════════════════════════════════
import { AbsoluteFill, Composition } from 'remotion'
import { CTAScreen } from '../components/CTAScreen'
import type { CTAOnlyProps } from '../../../types/clip-cta'
import type { CTAScreen as CTAScreenType } from '../../../types/video'

export const FPS_CTA = 30

export const CTAOnlyComposition: React.FC<CTAOnlyProps> = (props) => {
  const {
    template,
    imageUrl,
    headline,
    subtitle,
    buttonText,
    buttonUrl,
    closingLine,
    logoUrl,
  } = props

  // Build a CTAScreen-compatible object from our flat props
  const ctaScreen: CTAScreenType = {
    template:        template as CTAScreenType['template'],
    headlineText:    headline  ?? '',
    subtitleText:    subtitle  ?? undefined,
    buttonText:      buttonText ?? '',
    buttonUrl:       buttonUrl  ?? '',
    imageUrl:        imageUrl   ?? undefined,
    closingLine:     closingLine ?? undefined,
    durationSeconds: props.durationS,
  }

  // Determine theme from template name so colours are always correct
  const theme: 'dark' | 'light' =
    template === 'light-centered' ? 'light' : 'dark'

  return (
    <AbsoluteFill>
      <CTAScreen cta={ctaScreen} theme={theme} logoUrl={logoUrl} />
    </AbsoluteFill>
  )
}

// ── Remotion root entry for this composition ─────────────────
// Registered alongside AscentorKineticVideo in Root.tsx.
// calculateMetadata is what makes the composition dynamically
// sized and timed based on the clip's dimensions.
export const CTAOnlyRoot: React.FC = () => {
  return (
    <Composition
      id="CTAOnlyComposition"
      component={CTAOnlyComposition as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={240}   // fallback; overridden by calculateMetadata
      fps={FPS_CTA}
      width={1080}             // fallback; overridden by calculateMetadata
      height={1920}            // fallback; overridden by calculateMetadata
      defaultProps={{
        jobId:      'preview',
        template:   'dark-centered',
        durationS:  8,
        width:      1080,
        height:     1920,
        headline:   'Your next level starts here.',
        subtitle:   'Join 500+ ambitious professionals on Ascentor.',
        buttonText: 'Join free',
        buttonUrl:  'https://ascentorbi.com',
        logoUrl:    '',
      } as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const p = props as unknown as CTAOnlyProps
        return {
          durationInFrames: Math.ceil(p.durationS * FPS_CTA),
          fps:    FPS_CTA,
          width:  p.width  || 1080,
          height: p.height || 1920,
        }
      }}
    />
  )
}
