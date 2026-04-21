// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Shared Types
// Drop in: types/video.ts
// ═══════════════════════════════════════════════════════════

export type VideoTheme = 'dark' | 'light'
export type AudioMode = 'voiceover' | 'soundtrack' | 'none'
export type NarrativeStyle =
  | 'authentic-story'
  | 'hard-truth'
  | 'contrast'
  | 'insight'
  | 'challenge'
  | 'journey'
export type AudienceTier = 'explorer' | 'builder' | 'climber' | 'founders'
export type CTATemplate =
  | 'dark-centered'
  | 'image-top'
  | 'split'
  | 'light-centered'
  | 'fullbg-branded'
  | 'minimal-link'
  | 'fullbg-image'   // clip+CTA tool: full-screen image, no text overlay
export type SceneEmphasis = 'normal' | 'bold' | 'accent' | 'whisper'
export type SceneAnimation =
  | 'fade-up'
  | 'fade-in'
  | 'word-by-word'
  | 'slide-left'

// ── A single line within a scene ────────────────────────────
export interface SceneLine {
  text: string
  emphasis: SceneEmphasis   // controls font weight + color in Remotion
  delayMs: number           // stagger from scene start
}

// ── A single narrative scene ─────────────────────────────────
export interface NarrativeScene {
  id: string
  lines: SceneLine[]
  durationSeconds: number   // Claude decides — longer for heavier emotional beats
  animation: SceneAnimation
}

// ── CTA screen config ────────────────────────────────────────
export interface CTAScreen {
  template: CTATemplate
  headlineText: string
  subtitleText?: string
  buttonText: string
  buttonUrl: string
  imageUrl?: string         // Supabase Storage public URL — uploaded by admin
  closingLine?: string      // echoed from final narrative scene for minimal-link
  durationSeconds: number
}

// ── Full video job payload (passed to Trigger.dev) ──────────
export interface VideoJobPayload {
  jobId: string             // uuid — also the Supabase row id
  theme: VideoTheme
  logoUrl: string           // resolved dark/light logo from Supabase Storage
  scenes: NarrativeScene[]
  ctaScreen: CTAScreen
  audioMode: AudioMode
  trackMood?: string
  voiceoverScript?: string
  voiceoverUrl?: string       // resolved ElevenLabs/storage URL for Remotion mixing
  soundtrackUrl?: string      // resolved music track URL for Remotion mixing
  totalDurationSeconds: number
}

// ── What the admin submits ───────────────────────────────────
export interface VideoFormInput {
  goal: string
  keyMessage: string
  narrativeStyle: NarrativeStyle
  audienceTier: AudienceTier
  theme: VideoTheme
  ctaTemplate: CTATemplate
  ctaButtonText: string
  ctaButtonUrl: string
  ctaImageStorageUrl?: string
  audioMode: AudioMode
  trackMood?: string
}

// ── Claude story engine response ─────────────────────────────
export interface StoryEngineResponse {
  scenes: NarrativeScene[]
  ctaHeadline: string
  ctaSubtitle: string
  closingLine: string
  voiceoverScript: string
  totalDurationSeconds: number
}
