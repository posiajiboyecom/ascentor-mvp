// ═══════════════════════════════════════════════════════════
// Ascentor Clip+CTA Tool — Shared Types
// Drop in: types/clip-cta.ts
// ═══════════════════════════════════════════════════════════

// CTATemplate is defined in types/video.ts — re-exported here for convenience
export type { CTATemplate } from './video'

export type TransitionType = 'fade-black' | 'crossfade' | 'hard-cut'

// Aspect ratio presets for the in-browser image cropper
export type AspectPreset =
  | '1:1'       // Instagram square
  | '9:16'      // TikTok / Instagram Reels / Stories
  | '1.91:1'    // LinkedIn / Facebook landscape
  | '16:9'      // Twitter/X / YouTube

export const ASPECT_RATIOS: Record<AspectPreset, number> = {
  '1:1':     1,
  '9:16':    9 / 16,
  '1.91:1':  1.91,
  '16:9':    16 / 9,
}

// ── What the admin submits ───────────────────────────────────
export interface ClipCTAFormInput {
  ctaTemplate:      CTATemplate
  ctaDurationS:     number          // 3–15 seconds
  transitionType:   TransitionType
  ctaHeadline?:     string
  ctaSubtitle?:     string
  ctaButtonText?:   string
  ctaButtonUrl?:    string
  ctaClosingLine?:  string          // for minimal-link
  // Image (required for image-top and split templates)
  ctaImageBase64?:  string
  ctaImageMimeType?: string
  ctaAspectPreset?: AspectPreset
}

// ── Persisted job row (clip_cta_jobs table) ──────────────────
export interface ClipCTAJob {
  id:                string
  created_by:        string
  status:            'queued' | 'processing' | 'complete' | 'failed'
  clip_url:          string          // source clip in clip-uploads bucket
  clip_duration_s:   number | null
  clip_width:        number | null
  clip_height:       number | null
  cta_template:      CTATemplate
  cta_duration_s:    number
  cta_image_url:     string | null
  cta_headline:      string | null
  cta_subtitle:      string | null
  cta_button_text:   string | null
  cta_button_url:    string | null
  cta_closing_line:  string | null
  transition_type:   TransitionType
  video_url:         string | null
  error_message:     string | null
  trigger_run_id:    string | null
  created_at:        string
  started_at:        string | null
  completed_at:      string | null
  duration_ms:       number | null
  deleted_at:        string | null
}

// ── Trigger.dev task payload ─────────────────────────────────
export interface ClipCTATaskPayload {
  jobId:            string
  clipUrl:          string
  ctaImageUrl?:     string
  formInput:        ClipCTAFormInput
}

// ── Remotion CTAOnly composition props ──────────────────────
export interface CTAOnlyProps {
  jobId:          string
  template:       CTATemplate
  durationS:      number
  width:          number
  height:         number
  imageUrl?:      string
  headline?:      string
  subtitle?:      string
  buttonText?:    string
  buttonUrl?:     string
  closingLine?:   string
  logoUrl:        string
}
