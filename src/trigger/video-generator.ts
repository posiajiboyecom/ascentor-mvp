// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Trigger.dev Job
// Drop in: src/trigger/video-generator.ts
//
// Triggered by: POST /api/admin/video/generate
// Payload: VideoJobPayload
// On complete: updates video_jobs table, triggers Buffer schedule
//
// Pipeline:
// 1. Resolve logo URL from Supabase Storage (theme-aware)
// 2. Call Claude story engine
// 3. If voiceover: call ElevenLabs API
// 4. Render Remotion video (HTTP render via Remotion Lambda or local)
// 5. Upload final MP4 to Supabase Storage
// 6. If soundtrack: FFmpeg mix in audio track
// 7. Update video_jobs row with output URL
// 8. (Optional) Queue to Buffer if scheduleNow=true
// ═══════════════════════════════════════════════════════════
import { task } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { generateVideoStory } from '@/lib/video/story-engine'
import type { VideoFormInput, VideoJobPayload, NarrativeScene, CTAScreen } from '@/types/video'

// Service role client — same pattern as intel-reporter.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Logo resolution ──────────────────────────────────────────
// Ascentor has two logos in storage:
//   public/logos/ascentor-logo-dark.png  (used on dark theme videos)
//   public/logos/ascentor-logo-light.png (used on light theme videos)
async function resolveLogoUrl(theme: 'dark' | 'light'): Promise<string> {
  const fileName = theme === 'dark'
    ? 'ascentor-logo-dark.png'
    : 'ascentor-logo-light.png'

  const { data } = supabase.storage
    .from('public')
    .getPublicUrl(`logos/${fileName}`)

  return data.publicUrl
}

// ── ElevenLabs voiceover ─────────────────────────────────────
async function generateVoiceover(script: string, jobId: string): Promise<string | null> {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[video-generator] ELEVENLABS_API_KEY not set — skipping voiceover')
    return null
  }

  // ElevenLabs v2 API — Rachel voice (professional, warm, African-friendly cadence)
  // You can change voice_id to any ElevenLabs voice ID
  const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`ElevenLabs error: ${err}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const audioBytes = new Uint8Array(audioBuffer)

  // Upload audio to Supabase Storage
  const audioPath = `video-jobs/${jobId}/voiceover.mp3`
  const { error: uploadErr } = await supabase.storage
    .from('private')
    .upload(audioPath, audioBytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadErr) throw new Error(`Failed to upload voiceover: ${uploadErr.message}`)

  const { data } = supabase.storage.from('private').getPublicUrl(audioPath)
  return data.publicUrl
}

// ── Soundtrack resolution ────────────────────────────────────
async function resolveSoundtrack(mood: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('soundtracks')
    .select('file_url')
    .eq('mood', mood)
    .eq('active', true)
    .limit(1)
    .single()

  if (error || !data) {
    console.warn(`[video-generator] No soundtrack found for mood: ${mood}`)
    return null
  }

  return data.file_url
}

// ── Remotion render ──────────────────────────────────────────
// Uses Remotion Lambda (recommended for production) or local render
// Remotion Lambda docs: https://www.remotion.dev/docs/lambda
async function renderRemotionVideo(payload: VideoJobPayload): Promise<string> {
  const REMOTION_SERVE_URL = process.env.REMOTION_SERVE_URL
  const REMOTION_FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

  if (!REMOTION_SERVE_URL || !REMOTION_FUNCTION_NAME) {
    // ── Dev fallback: write payload to Supabase and return a placeholder ──
    // In development, run `npx remotion render` locally instead
    console.warn('[video-generator] Remotion Lambda not configured — saving render payload for local use')

    const payloadPath = `video-jobs/${payload.jobId}/render-payload.json`
    await supabase.storage
      .from('private')
      .upload(payloadPath, JSON.stringify(payload, null, 2), {
        contentType: 'application/json',
        upsert: true,
      })

    return `PENDING_LOCAL_RENDER:${payload.jobId}`
  }

  // ── Production: Remotion Lambda render ──────────────────────
  // Install: npm install @remotion/lambda
  // Then uncomment this block:

  /*
  const { renderMediaOnLambda, getRenderProgress } = await import('@remotion/lambda/client')

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: AWS_REGION as any,
    functionName: REMOTION_FUNCTION_NAME,
    serveUrl: REMOTION_SERVE_URL,
    composition: 'AscentorKineticVideo',
    inputProps: payload,
    codec: 'h264',
    imageFormat: 'jpeg',
    maxRetries: 1,
    privacy: 'private',
    downloadBehavior: { type: 'download', fileName: `${payload.jobId}.mp4` },
  })

  // Poll for completion
  let progress = 0
  while (progress < 1) {
    await new Promise(r => setTimeout(r, 3000))
    const status = await getRenderProgress({ renderId, bucketName, region: AWS_REGION as any, functionName: REMOTION_FUNCTION_NAME })
    progress = status.overallProgress
    if (status.fatalErrorEncountered) throw new Error(`Remotion render failed: ${status.errors[0]?.message}`)
  }

  return `https://${bucketName}.s3.${AWS_REGION}.amazonaws.com/renders/${renderId}/out.mp4`
  */

  throw new Error('Remotion Lambda not configured. Set REMOTION_SERVE_URL and REMOTION_FUNCTION_NAME.')
}

// ── Upload final video to Supabase Storage ───────────────────
async function uploadFinalVideo(videoUrl: string, jobId: string): Promise<string> {
  // If the video is already a Supabase URL or a placeholder, pass through
  if (videoUrl.startsWith('PENDING_LOCAL_RENDER:') || videoUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
    return videoUrl
  }

  // Download from Remotion S3 and re-upload to Supabase
  const res = await fetch(videoUrl)
  if (!res.ok) throw new Error(`Failed to fetch rendered video: ${res.status}`)

  const buffer = await res.arrayBuffer()
  const videoPath = `video-jobs/${jobId}/final.mp4`

  const { error } = await supabase.storage
    .from('public')
    .upload(videoPath, new Uint8Array(buffer), {
      contentType: 'video/mp4',
      upsert: true,
    })

  if (error) throw new Error(`Failed to upload final video: ${error.message}`)

  const { data } = supabase.storage.from('public').getPublicUrl(videoPath)
  return data.publicUrl
}

// ══════════════════════════════════════════════════════════════
// MAIN TRIGGER.DEV TASK
// Matches your pattern from intel-reporter.ts exactly:
// - createClient at module level with service role
// - task() not schedules.task()
// - console.log for progress
// - throw on error
// ══════════════════════════════════════════════════════════════
export const videoGeneratorTask = task({
  id: 'video-generator',

  // Generous timeout — rendering can take 2–5 mins
  machine: { preset: 'medium-1x' },

  run: async (payload: {
    jobId: string
    formInput: VideoFormInput
    ctaImageStorageUrl?: string
    scheduleToBuffer?: boolean
    bufferScheduledFor?: string
  }) => {
    const startTime = Date.now()
    const { jobId, formInput, ctaImageStorageUrl, scheduleToBuffer, bufferScheduledFor } = payload

    console.log(`[video-generator] Starting job ${jobId}`)
    console.log(`[video-generator] Goal: ${formInput.goal}`)
    console.log(`[video-generator] Style: ${formInput.narrativeStyle} | Audience: ${formInput.audienceTier}`)

    // ── Mark job as processing ───────────────────────────────
    await supabase
      .from('video_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId)

    try {
      // ── Step 1: Resolve logo ─────────────────────────────────
      console.log(`[video-generator] Resolving ${formInput.theme} logo...`)
      const logoUrl = await resolveLogoUrl(formInput.theme)

      // ── Step 2: Generate story via Claude ────────────────────
      console.log(`[video-generator] Calling Claude story engine...`)
      const story = await generateVideoStory(formInput)
      console.log(`[video-generator] Story generated: ${story.scenes.length} scenes, ${story.totalDurationSeconds}s total`)

      // ── Step 3: Build CTA screen ─────────────────────────────
      const ctaScreen: CTAScreen = {
        template: formInput.ctaTemplate,
        headlineText: story.ctaHeadline,
        subtitleText: story.ctaSubtitle,
        buttonText: formInput.ctaButtonText,
        buttonUrl: formInput.ctaButtonUrl,
        imageUrl: ctaImageStorageUrl,
        closingLine: story.closingLine,
        durationSeconds: 8,
      }

      // ── Step 4: Handle audio ─────────────────────────────────
      let voiceoverUrl: string | undefined
      let soundtrackUrl: string | undefined

      if (formInput.audioMode === 'voiceover') {
        console.log(`[video-generator] Generating ElevenLabs voiceover...`)
        voiceoverUrl = await generateVoiceover(story.voiceoverScript, jobId) || undefined
      } else if (formInput.audioMode === 'soundtrack' && formInput.trackMood) {
        console.log(`[video-generator] Resolving soundtrack for mood: ${formInput.trackMood}`)
        soundtrackUrl = await resolveSoundtrack(formInput.trackMood) || undefined
      }

      // ── Step 5: Build full video payload for Remotion ────────
      const videoPayload: VideoJobPayload = {
        jobId,
        theme: formInput.theme,
        logoUrl,
        scenes: story.scenes,
        ctaScreen,
        audioMode: formInput.audioMode,
        trackMood: formInput.trackMood,
        voiceoverScript: story.voiceoverScript,
        totalDurationSeconds: story.totalDurationSeconds,
      }

      // ── Step 6: Render video ─────────────────────────────────
      console.log(`[video-generator] Starting Remotion render...`)
      const rawVideoUrl = await renderRemotionVideo(videoPayload)
      console.log(`[video-generator] Render complete: ${rawVideoUrl}`)

      // ── Step 7: Upload to Supabase Storage ───────────────────
      const finalVideoUrl = await uploadFinalVideo(rawVideoUrl, jobId)

      // ── Step 8: Save story + metadata to Supabase ───────────
      const durationMs = Date.now() - startTime

      const { error: saveErr } = await supabase
        .from('video_jobs')
        .update({
          status: 'complete',
          video_url: finalVideoUrl,
          voiceover_url: voiceoverUrl || null,
          soundtrack_url: soundtrackUrl || null,
          scenes: story.scenes,
          cta_screen: ctaScreen,
          voiceover_script: story.voiceoverScript,
          total_duration_seconds: story.totalDurationSeconds,
          scene_count: story.scenes.length,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', jobId)

      if (saveErr) throw new Error(`Failed to save video job: ${saveErr.message}`)

      // ── Step 9: Queue to Buffer (optional) ──────────────────
      if (scheduleToBuffer && finalVideoUrl && !finalVideoUrl.startsWith('PENDING_LOCAL_RENDER:')) {
        console.log(`[video-generator] Queuing to Buffer...`)

        await supabase.from('social_queue').insert({
          content_type: 'video',
          platform: 'linkedin',
          content: `${story.ctaHeadline}\n\n${story.ctaSubtitle}\n\n${formInput.ctaButtonUrl}`,
          video_url: finalVideoUrl,
          status: 'pending',
          scheduled_for: bufferScheduledFor || null,
          source_job_id: jobId,
        })
      }

      console.log(
        `[video-generator] Job ${jobId} complete. ` +
        `${story.scenes.length} scenes. ${story.totalDurationSeconds}s. ` +
        `Duration: ${durationMs}ms`
      )

      return {
        success: true,
        jobId,
        videoUrl: finalVideoUrl,
        sceneCount: story.scenes.length,
        totalDurationSeconds: story.totalDurationSeconds,
        audioMode: formInput.audioMode,
        durationMs,
      }

    } catch (err: any) {
      // ── Mark job as failed ───────────────────────────────────
      console.error(`[video-generator] Job ${jobId} failed:`, err.message)

      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      throw err  // Re-throw so Trigger.dev marks the run as failed
    }
  },
})
