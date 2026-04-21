// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Remotion Composition
// Drop in: remotion/src/AscentorKineticVideo.tsx
//
// Install Remotion first:
//   npm install remotion @remotion/player @remotion/bundler @remotion/renderer
//
// To preview locally:
//   npx remotion studio
//
// To render locally:
//   npx remotion render AscentorKineticVideo out/video.mp4 --props='{"jobId":"test",...}'
// ═══════════════════════════════════════════════════════════
import React, { type ComponentType } from 'react'
import {
  Composition,
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  staticFile,
  Series,
  Audio,
} from 'remotion'
import type {
  VideoJobPayload,
  NarrativeScene,
  SceneLine,
  CTAScreen,
  VideoTheme,
  SceneEmphasis,
  SceneAnimation,
} from '../../types/video'

// ── Theme tokens ─────────────────────────────────────────────
// CONTRAST RULE (hard): text colour must never be similar to its background.
// Every pairing below has been checked: light text on dark bg, dark text on
// light bg, dark text on gold — no exceptions.
//
// Brand book references (Ascentor Brand Book v1.0):
//   §03 Colour Palette  — primary swatches and usage rules
//   §08 Digital Application — digital contrast requirements
//   §10 Brand in Motion — video-specific guidance
//
// Exploratory note: we go beyond the brand book's two standard themes.
// The brand permits creative use of tier colours, texture, and gold variants
// in video/editorial contexts as long as contrast is maintained.
const THEMES = {

  // ── DARK THEME ────────────────────────────────────────────
  // Deep warm-black surface (brand: Dark 900 = #0C0B08)
  // All text runs light on dark — none of the text values are near
  // the bg darkness. Gold 500 (#E8A020) is safe on this surface (~6:1).
  dark: {
    bg:            '#0C0B08',   // Ascentor Black — Dark 900
    textPrimary:   '#F7F6F3',   // Dark 50 — near-white warm. ~18:1 on bg ✓
    textSecondary: '#C8C3B8',   // Dark 200 — muted warm grey. ~10:1 on bg ✓
    textWhisper:   '#7A7260',   // Dark 400 — intentionally dim italic. ~4.5:1 ✓
    accent:        '#E8A020',   // Gold 500 — brand primary gold. ~6:1 on black ✓
    ctaBg:         '#1E1C17',   // Dark 700 — slightly lifted CTA card surface
    ctaButton:     '#E8A020',   // Gold 500 bg
    ctaButtonText: '#0C0B08',   // Ascentor Black on gold — brand-mandated ✓
    linkColor:     '#F5C55A',   // Gold 300 — lighter gold for dark bg links ✓
  },

  // ── LIGHT THEME ───────────────────────────────────────────
  // Parchment surface (brand: never use pure white as a page bg in video).
  // All text runs dark on parchment. The standard Gold 500 (#E8A020) fails
  // contrast on parchment — brand book mandates the darker gold (#A0720A)
  // for light surfaces. CTA button uses near-black for max contrast on white.
  light: {
    bg:            '#F5F3EE',   // Parchment — brand light surface
    textPrimary:   '#1A1714',   // near-black. ~16:1 on parchment ✓
    textSecondary: '#4A3F30',   // warm dark brown. ~8:1 on parchment ✓
    textWhisper:   '#7A6A55',   // warm mid-brown — dim but readable ~4.5:1 ✓
    accent:        '#A0720A',   // Darker Gold — brand-spec for light bg ✓
    ctaBg:         '#FFFFFF',   // White card surface on parchment page
    ctaButton:     '#1A1714',   // near-black — strong contrast on white ✓
    ctaButtonText: '#F7F6F3',   // near-white — clear on near-black ✓
    linkColor:     '#185FA5',   // Dark blue — passes contrast on white ✓
  },

}

// ── Emphasis → style mapping ─────────────────────────────────
function getLineStyle(emphasis: SceneEmphasis, theme: VideoTheme): React.CSSProperties {
  const t = THEMES[theme]
  const base: React.CSSProperties = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    textAlign: 'center',
    lineHeight: 1.45,
    marginBottom: 20,
    display: 'block',
  }

  switch (emphasis) {
    case 'bold':
      return { ...base, fontSize: 38, fontWeight: 700, color: t.textPrimary }
    case 'accent':
      return { ...base, fontSize: 34, fontWeight: 700, color: t.accent, letterSpacing: '0.01em' }
    case 'whisper':
      return { ...base, fontSize: 24, fontWeight: 400, color: t.textWhisper, fontStyle: 'italic' }
    case 'normal':
    default:
      return { ...base, fontSize: 30, fontWeight: 400, color: t.textSecondary }
  }
}

// ── Single animated line ─────────────────────────────────────
function AnimatedLine({
  line,
  theme,
  animation,
  sceneFrame,
}: {
  line: SceneLine
  theme: VideoTheme
  animation: SceneAnimation
  sceneFrame: number
}) {
  const { fps } = useVideoConfig()
  const delayFrames = Math.round((line.delayMs / 1000) * fps)
  const localFrame = Math.max(0, sceneFrame - delayFrames)

  const style = getLineStyle(line.emphasis, theme)

  let opacity = 1
  let translateY = 0
  let translateX = 0
  let scale = 1

  switch (animation) {
    case 'fade-up':
      // 18 → 24 frames: drifts in over 0.8s instead of snapping in at 0.6s
      opacity = interpolate(localFrame, [0, 24], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
      translateY = interpolate(localFrame, [0, 24], [24, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
      break

    case 'fade-in':
      // 20 → 28 frames: gentlest entry, now 0.93s — suits quiet/reflective scenes
      opacity = interpolate(localFrame, [0, 28], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      })
      break

    case 'word-by-word':
      // scale 10 → 18, opacity 8 → 14: still punchy but no longer a snap
      scale = interpolate(localFrame, [0, 18], [0.92, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
      })
      opacity = interpolate(localFrame, [0, 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      break

    case 'slide-left':
      // 16 → 22 frames: slides in over 0.73s instead of 0.53s
      opacity = interpolate(localFrame, [0, 22], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
      translateX = interpolate(localFrame, [0, 22], [-40, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
      break
  }

  return (
    <span
      style={{
        ...style,
        opacity,
        transform: `translateY(${translateY}px) translateX(${translateX}px) scale(${scale})`,
        display: 'block',
      }}
    >
      {line.text}
    </span>
  )
}

// ── Scene fade out ───────────────────────────────────────────
function SceneFadeOut({ durationFrames }: { durationFrames: number }) {
  const frame = useCurrentFrame()
  // 12 → 20 frames: black transition now 0.67s instead of 0.4s — more deliberate pause
  const fadeStart = durationFrames - 20

  const opacity = interpolate(
    frame,
    [fadeStart, durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) }
  )

  return (
    <AbsoluteFill
      style={{ backgroundColor: '#000000', opacity, pointerEvents: 'none' }}
    />
  )
}

// ── Logo watermark ───────────────────────────────────────────
function LogoWatermark({ logoUrl }: { logoUrl: string }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 20], [0, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 40,
        opacity,
        zIndex: 100,
      }}
    >
      <Img
        src={logoUrl}
        style={{ height: 32, width: 'auto' }}
        pauseWhenLoading={false}
      />
    </div>
  )
}

// ── Narrative scene ──────────────────────────────────────────
function NarrativeSceneComp({
  scene,
  theme,
  logoUrl,
}: {
  scene: NarrativeScene
  theme: VideoTheme
  logoUrl: string
}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const t = THEMES[theme]

  return (
    <AbsoluteFill style={{ backgroundColor: t.bg }}>
      <LogoWatermark logoUrl={logoUrl} />

      {/* Centered text block */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 80px',
        }}
      >
        {scene.lines.map((line, i) => (
          <AnimatedLine
            key={i}
            line={line}
            theme={theme}
            animation={scene.animation}
            sceneFrame={frame}
          />
        ))}
      </AbsoluteFill>

      {/* Fade out overlay */}
      <SceneFadeOut durationFrames={durationInFrames} />
    </AbsoluteFill>
  )
}

// ── CTA Templates ────────────────────────────────────────────
function CTASceneComp({
  cta,
  theme,
  logoUrl,
}: {
  cta: CTAScreen
  theme: VideoTheme
  logoUrl: string
}) {
  const frame = useCurrentFrame()
  const t = THEMES[theme]

  const contentOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const contentY = interpolate(frame, [0, 25], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  const buttonOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const buttonScale = interpolate(frame, [20, 40], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.2)),
  })

  const sharedButton = (
    <div
      style={{
        opacity: buttonOpacity,
        transform: `scale(${buttonScale})`,
        marginTop: 32,
      }}
    >
      <div
        style={{
          backgroundColor: t.ctaButton,
          color: t.ctaButtonText,
          padding: '18px 48px',
          borderRadius: 8,
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}
      >
        {cta.buttonText}
      </div>
      <div
        style={{
          fontSize: 16,
          color: t.textWhisper,
          textAlign: 'center',
          marginTop: 12,
          fontFamily: 'Georgia, serif',
        }}
      >
        {cta.buttonUrl}
      </div>
    </div>
  )

  // ── Template: dark-centered / light-centered ─────────────
  if (cta.template === 'dark-centered' || cta.template === 'light-centered') {
    return (
      <AbsoluteFill style={{ backgroundColor: t.ctaBg }}>
        <LogoWatermark logoUrl={logoUrl} />
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 80px',
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
          }}
        >
          <div style={{ fontSize: 42, fontWeight: 700, color: t.textPrimary, fontFamily: 'Georgia, serif', textAlign: 'center', lineHeight: 1.3, marginBottom: 16 }}>
            {cta.headlineText}
          </div>
          {cta.subtitleText && (
            <div style={{ fontSize: 24, color: t.textSecondary, fontFamily: 'Georgia, serif', textAlign: 'center', lineHeight: 1.5, marginBottom: 8 }}>
              {cta.subtitleText}
            </div>
          )}
          {sharedButton}
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  // ── Template: image-top ──────────────────────────────────
  if (cta.template === 'image-top') {
    return (
      <AbsoluteFill style={{ backgroundColor: t.ctaBg }}>
        <LogoWatermark logoUrl={logoUrl} />
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 60px',
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
          }}
        >
          {cta.imageUrl && (
            <Img
              src={cta.imageUrl}
              style={{ width: 280, height: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 32 }}
              pauseWhenLoading={false}
            />
          )}
          <div style={{ fontSize: 36, fontWeight: 700, color: t.textPrimary, fontFamily: 'Georgia, serif', textAlign: 'center', lineHeight: 1.3, marginBottom: 12 }}>
            {cta.headlineText}
          </div>
          {cta.subtitleText && (
            <div style={{ fontSize: 22, color: t.textSecondary, fontFamily: 'Georgia, serif', textAlign: 'center' }}>
              {cta.subtitleText}
            </div>
          )}
          {sharedButton}
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  // ── Template: split ──────────────────────────────────────
  if (cta.template === 'split') {
    return (
      <AbsoluteFill style={{ backgroundColor: t.ctaBg }}>
        <LogoWatermark logoUrl={logoUrl} />
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'row',
            opacity: contentOpacity,
          }}
        >
          {/* Left: image */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            {cta.imageUrl ? (
              <Img
                src={cta.imageUrl}
                style={{ width: '100%', height: 400, objectFit: 'cover', borderRadius: 12 }}
                pauseWhenLoading={false}
              />
            ) : (
              // Fallback placeholder — theme-aware so it doesn't read as
              // a dark block on a light-theme CTA surface
              <div style={{
                width: '100%', height: 400, borderRadius: 12,
                backgroundColor: theme === 'dark' ? '#2E2A22' : '#E2DDD4',
              }} />
            )}
          </div>
          {/* Right: text + CTA */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 60px 40px 20px' }}>
            <div style={{ fontSize: 38, fontWeight: 700, color: t.textPrimary, fontFamily: 'Georgia, serif', lineHeight: 1.3, marginBottom: 16 }}>
              {cta.headlineText}
            </div>
            {cta.subtitleText && (
              <div style={{ fontSize: 22, color: t.textSecondary, fontFamily: 'Georgia, serif', lineHeight: 1.5 }}>
                {cta.subtitleText}
              </div>
            )}
            {sharedButton}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  // ── Template: fullbg-branded ─────────────────────────────
  // Self-contained palette — ignores the theme token so it always
  // renders the same brand-accurate dark surface regardless of the
  // job's theme setting. All contrast pairs verified below.
  if (cta.template === 'fullbg-branded') {
    // Dark 800 surface — deep brand bg, slightly warmer than pure black
    const BB_BG       = '#141310'   // bg surface
    // Gold 500 headline — ~6:1 on #141310 ✓  (light text on dark bg)
    const BB_HEADLINE = '#E8A020'
    // Dark 200 warm grey subtitle — ~9:1 on #141310 ✓
    const BB_SUBTITLE = '#C8C3B8'
    // Near-white button bg — ~17:1 on #141310 ✓
    const BB_BTN_BG   = '#F7F6F3'
    // Ascentor Black button text — ~17:1 on near-white ✓ (brand-mandated)
    const BB_BTN_TEXT = '#0C0B08'
    return (
      <AbsoluteFill style={{ backgroundColor: BB_BG }}>
        <LogoWatermark logoUrl={logoUrl} />
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 80px',
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
          }}
        >
          <div style={{ fontSize: 46, fontWeight: 700, color: BB_HEADLINE, fontFamily: 'Georgia, serif', textAlign: 'center', lineHeight: 1.25, marginBottom: 16 }}>
            {cta.headlineText}
          </div>
          {cta.subtitleText && (
            <div style={{ fontSize: 24, color: BB_SUBTITLE, fontFamily: 'Georgia, serif', textAlign: 'center' }}>
              {cta.subtitleText}
            </div>
          )}
          <div
            style={{
              opacity: buttonOpacity,
              transform: `scale(${buttonScale})`,
              marginTop: 40,
              backgroundColor: BB_BTN_BG,
              color: BB_BTN_TEXT,
              padding: '18px 48px',
              borderRadius: 8,
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            {cta.buttonText}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  // ── Template: minimal-link ───────────────────────────────
  if (cta.template === 'minimal-link') {
    return (
      <AbsoluteFill style={{ backgroundColor: t.ctaBg }}>
        <LogoWatermark logoUrl={logoUrl} />
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 100px',
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
          }}
        >
          {cta.closingLine && (
            <div style={{ fontSize: 32, color: t.textSecondary, fontFamily: 'Georgia, serif', fontStyle: 'italic', textAlign: 'center', marginBottom: 40, lineHeight: 1.5 }}>
              "{cta.closingLine}"
            </div>
          )}
          <div style={{ fontSize: 28, fontWeight: 700, color: t.textPrimary, fontFamily: 'Georgia, serif', textAlign: 'center', marginBottom: 20 }}>
            {cta.headlineText}
          </div>
          <div style={{ opacity: buttonOpacity, fontSize: 22, color: t.linkColor, fontFamily: 'Georgia, serif', textDecoration: 'underline' }}>
            {cta.buttonUrl}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  // Fallback to dark-centered
  return <AbsoluteFill style={{ backgroundColor: t.ctaBg }} />
}

// ── Root composition ─────────────────────────────────────────
export function AscentorKineticVideo(props: VideoJobPayload) {
  const { fps } = useVideoConfig()
  const { scenes, ctaScreen, theme, logoUrl, audioMode, voiceoverScript } = props

  return (
    <>
      <Series>
        {/* Narrative scenes */}
        {scenes.map((scene) => (
          <Series.Sequence
            key={scene.id}
            durationInFrames={Math.round(scene.durationSeconds * fps)}
          >
            <NarrativeSceneComp
              scene={scene}
              theme={theme}
              logoUrl={logoUrl}
            />
          </Series.Sequence>
        ))}

        {/* CTA screen */}
        <Series.Sequence durationInFrames={Math.round(ctaScreen.durationSeconds * fps)}>
          <CTASceneComp cta={ctaScreen} theme={theme} logoUrl={logoUrl} />
        </Series.Sequence>
      </Series>
    </>
  )
}

// ── Remotion root — register composition ─────────────────────
// This is what remotion/src/index.ts should export:
export function RemotionRoot() {
  // Default props for Remotion Studio preview
  const defaultProps: VideoJobPayload = {
    jobId: 'preview',
    theme: 'dark',
    logoUrl: staticFile('logos/ascentor-logo-dark.png'),
    scenes: [
      {
        id: 'scene_01',
        lines: [
          { text: 'Most people wait for the right moment.', emphasis: 'normal', delayMs: 0 },
          { text: 'The perfect conditions.', emphasis: 'normal', delayMs: 600 },
        ],
        durationSeconds: 4,
        animation: 'fade-up',
      },
      {
        id: 'scene_02',
        lines: [
          { text: 'But here is what nobody tells you:', emphasis: 'whisper', delayMs: 0 },
          { text: 'The conditions never become ideal.', emphasis: 'bold', delayMs: 800 },
        ],
        durationSeconds: 5,
        animation: 'word-by-word',
      },
      {
        id: 'scene_03',
        lines: [
          { text: 'The leaders who rise', emphasis: 'normal', delayMs: 0 },
          { text: 'did not wait for permission.', emphasis: 'normal', delayMs: 600 },
          { text: 'They built their own table.', emphasis: 'accent', delayMs: 1400 },
        ],
        durationSeconds: 6,
        animation: 'fade-up',
      },
    ],
    ctaScreen: {
      template: 'dark-centered',
      headlineText: 'Your next level starts here.',
      subtitleText: 'Join 500+ ambitious professionals on Ascentor.',
      buttonText: 'Join free today',
      buttonUrl: 'https://ascentorbi.com',
      durationSeconds: 8,
    },
    audioMode: 'none',
    totalDurationSeconds: 23,
  }

  const totalFrames = Math.round(defaultProps.totalDurationSeconds * 30)

  return (
    <Composition
      id="AscentorKineticVideo"
      component={AscentorKineticVideo as unknown as ComponentType<Record<string, unknown>>}
      durationInFrames={totalFrames}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        // Dynamic duration based on actual scenes
        const typedProps = props as unknown as VideoJobPayload
        const sceneDuration = typedProps.scenes.reduce((s, sc) => s + sc.durationSeconds, 0)
        const total = sceneDuration + typedProps.ctaScreen.durationSeconds
        return { durationInFrames: Math.round(total * 30) }
      }}
    />
  )
}
