// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Trigger.dev Job (v2)
// Drop in: src/trigger/video-generator.ts
//
// Renders Remotion video DIRECTLY inside the Trigger.dev job.
// No AWS. No Lambda. No separate server.
//
// How it works:
// 1. Claude story engine generates scenes
// 2. renderMedia() from @remotion/renderer renders MP4 in-process
// 3. Output buffer uploaded directly to Supabase Storage
// 4. ElevenLabs or soundtrack mixed in via ffmpeg-static if needed
//
// Install:
//   npm install @remotion/renderer @remotion/bundler ffmpeg-static
// ═══════════════════════════════════════════════════════════
import { task }         from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'
import { generateVideoStory } from '@/lib/video/story-engine'
import type {
  VideoFormInput,
  VideoJobPayload,
  CTAScreen,
} from '@/types/video'

// Service role client — same pattern as intel-reporter.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Resolve theme-aware logo from Supabase Storage ───────────
async function resolveLogoUrl(theme: 'dark' | 'light'): Promise<string> {
  const fileName = theme === 'dark'
    ? 'ascentor-logo-dark.png'
    : 'ascentor-logo-light.png'
  const { data } = supabase.storage
    .from('public')
    .getPublicUrl(`logos/${fileName}`)
  return data.publicUrl
}

// ── ElevenLabs voiceover → returns Supabase Storage URL ─────
async function generateVoiceover(
  script: string,
  jobId: string
): Promise<string | null> {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[video-generator] No ELEVENLABS_API_KEY — skipping voiceover')
    return null
  }
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    }
  )
  if (!res.ok) throw new Error(`ElevenLabs error: ${await res.text()}`)
  const buf = await res.arrayBuffer()
  const path = `video-jobs/${jobId}/voiceover.mp3`
  const { error } = await supabase.storage
    .from('private')
    .upload(path, new Uint8Array(buf), { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`Voiceover upload failed: ${error.message}`)
  return supabase.storage.from('private').getPublicUrl(path).data.publicUrl
}

// ── Soundtrack lookup from soundtracks table ─────────────────
async function resolveSoundtrack(mood: string): Promise<string | null> {
  const { data } = await supabase
    .from('soundtracks')
    .select('file_url')
    .eq('mood', mood)
    .eq('active', true)
    .limit(1)
    .single()
  return data?.file_url ?? null
}

// ── Core render: Remotion directly in-process ────────────────
// @remotion/renderer runs headless Chrome inside the Trigger.dev
// container — no Lambda, no AWS, no separate server needed.
async function renderVideo(payload: VideoJobPayload): Promise<Buffer> {
  // Dynamic import so TypeScript doesn't fail if not yet installed
  const { bundle }      = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')
  const path            = await import('path')
  const os              = await import('os')
  const fs              = await import('fs')

  console.log('[video-generator] Bundling Remotion composition...')

  // Bundle the Remotion project — force webpack (rspack crashes in Trigger.dev containers)
  const bundleLocation = await bundle({
    entryPoint: path.resolve(process.cwd(), 'remotion/src/index.ts'),
    webpackOverride: (config) => {
      // Force webpack mode — disable rspack which fails in Linux containers
      config.experiments = { ...config.experiments, rspack: false }
      return config
    },
  })

  console.log('[video-generator] Selecting composition...')

  // Resolve the composition and its real duration from scene data
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'AscentorKineticVideo',
    inputProps: payload as unknown as Record<string, unknown>,
  })

  // Write output to a temp file
  const tmpFile = path.join(os.tmpdir(), `ascentor-${payload.jobId}.mp4`)

  console.log(`[video-generator] Rendering ${composition.durationInFrames} frames at ${composition.fps}fps...`)

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: tmpFile,
    inputProps: payload as unknown as Record<string, unknown>,
    // Quality settings — balance between file size and quality
    crf: 22,
    // Concurrency: 1 is safe inside Trigger.dev container, 2 if you have medium-2x
    concurrency: 1,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 20 === 0) {
        console.log(`[video-generator] Render progress: ${Math.round(progress * 100)}%`)
      }
    },
  })

  const buffer = fs.readFileSync(tmpFile)
  fs.unlinkSync(tmpFile)  // clean up temp file

  console.log(`[video-generator] Render complete. Size: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`)
  return buffer
}

// ══════════════════════════════════════════════════════════════
// MAIN TRIGGER.DEV TASK
// ══════════════════════════════════════════════════════════════
export const videoGeneratorTask = task({
  id: 'video-generator',

  // medium-2x gives 2 vCPU + 4GB RAM — enough for Remotion headless Chrome
  // If renders are slow, upgrade to large-1x
  machine: { preset: 'medium-2x' },

  run: async (payload: {
    jobId:              string
    formInput:          VideoFormInput
    ctaImageStorageUrl?: string
    scheduleToBuffer?:  boolean
    bufferScheduledFor?: string
  }) => {
    const startTime = Date.now()
    const { jobId, formInput, ctaImageStorageUrl, scheduleToBuffer, bufferScheduledFor } = payload

    console.log(`[video-generator] Job ${jobId} started`)
    console.log(`[video-generator] Goal: ${formInput.goal}`)
    console.log(`[video-generator] Style: ${formInput.narrativeStyle} | Tier: ${formInput.audienceTier}`)

    // ── Mark processing ──────────────────────────────────────
    await supabase
      .from('video_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId)

    try {
      // ── 1. Logo ──────────────────────────────────────────────
      console.log('[video-generator] Resolving logo...')
      const logoUrl = await resolveLogoUrl(formInput.theme)

      // ── 2. Story via Claude ──────────────────────────────────
      console.log('[video-generator] Generating story...')
      const story = await generateVideoStory(formInput)
      console.log(`[video-generator] ${story.scenes.length} scenes · ${story.totalDurationSeconds}s`)

      // ── 3. CTA screen ────────────────────────────────────────
      const ctaScreen: CTAScreen = {
        template:        formInput.ctaTemplate,
        headlineText:    story.ctaHeadline,
        subtitleText:    story.ctaSubtitle,
        buttonText:      formInput.ctaButtonText,
        buttonUrl:       formInput.ctaButtonUrl,
        imageUrl:        ctaImageStorageUrl,
        closingLine:     story.closingLine,
        durationSeconds: 8,
      }

      // ── 4. Audio ─────────────────────────────────────────────
      let voiceoverUrl:  string | undefined
      let soundtrackUrl: string | undefined

      if (formInput.audioMode === 'voiceover') {
        console.log('[video-generator] Generating voiceover...')
        voiceoverUrl = await generateVoiceover(story.voiceoverScript, jobId) ?? undefined
      } else if (formInput.audioMode === 'soundtrack' && formInput.trackMood) {
        console.log(`[video-generator] Resolving soundtrack (${formInput.trackMood})...`)
        soundtrackUrl = await resolveSoundtrack(formInput.trackMood) ?? undefined
      }

      // ── 5. Build Remotion payload ────────────────────────────
      const videoPayload: VideoJobPayload = {
        jobId,
        theme:                  formInput.theme,
        logoUrl,
        scenes:                 story.scenes,
        ctaScreen,
        audioMode:              formInput.audioMode,
        trackMood:              formInput.trackMood,
        voiceoverScript:        story.voiceoverScript,
        totalDurationSeconds:   story.totalDurationSeconds,
        // Pass audio URLs so Remotion can mix them in
        voiceoverUrl,
        soundtrackUrl,
      }

      // ── 6. Render directly in-process ───────────────────────
      console.log('[video-generator] Starting Remotion render...')
      const videoBuffer = await renderVideo(videoPayload)

      // ── 7. Upload to Supabase Storage ────────────────────────
      console.log('[video-generator] Uploading to Supabase...')
      const videoPath = `video-jobs/${jobId}/final.mp4`
      const { error: uploadErr } = await supabase.storage
        .from('public')
        .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

      const { data: { publicUrl: finalVideoUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(videoPath)

      // ── 8. Save to video_jobs ────────────────────────────────
      const durationMs = Date.now() - startTime
      const { error: saveErr } = await supabase
        .from('video_jobs')
        .update({
          status:                  'complete',
          video_url:               finalVideoUrl,
          voiceover_url:           voiceoverUrl  ?? null,
          soundtrack_url:          soundtrackUrl ?? null,
          scenes:                  story.scenes,
          cta_screen:              ctaScreen,
          voiceover_script:        story.voiceoverScript,
          total_duration_seconds:  story.totalDurationSeconds,
          scene_count:             story.scenes.length,
          completed_at:            new Date().toISOString(),
          duration_ms:             durationMs,
        })
        .eq('id', jobId)
      if (saveErr) throw new Error(`Save failed: ${saveErr.message}`)

      // ── 9. Optionally queue to Buffer ────────────────────────
      if (scheduleToBuffer) {
        await supabase.from('social_queue').insert({
          content_type:   'video',
          platform:       'linkedin',
          content:        `${story.ctaHeadline}\n\n${story.ctaSubtitle}\n\n${formInput.ctaButtonUrl}`,
          video_url:      finalVideoUrl,
          status:         'pending',
          scheduled_for:  bufferScheduledFor ?? null,
          source_job_id:  jobId,
        })
        console.log('[video-generator] Queued to social_queue for Buffer.')
      }

      console.log(
        `[video-generator] Job ${jobId} complete. ` +
        `${story.scenes.length} scenes · ${story.totalDurationSeconds}s · ${durationMs}ms`
      )

      return {
        success:              true,
        jobId,
        videoUrl:             finalVideoUrl,
        sceneCount:           story.scenes.length,
        totalDurationSeconds: story.totalDurationSeconds,
        durationMs,
      }

    } catch (err: any) {
      console.error(`[video-generator] Job ${jobId} failed:`, err.message)
      await supabase
        .from('video_jobs')
        .update({
          status:        'failed',
          error_message: err.message,
          completed_at:  new Date().toISOString(),
        })
        .eq('id', jobId)
      throw err
    }
  },
})
