// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Trigger.dev Job (Phase 4+5 patched)
// Drop in: src/trigger/video-generator.ts
//
// Phase 4+5 changes:
//   • Records trigger_run_id on the row as soon as the task
//     starts (so the cancel/retry routes can find it even
//     before the generate route's response reaches the client).
//   • Wraps each pipeline step with timing.
//   • Persists cost_usd_claude from the story engine.
//   • Persists cost_usd_elevenlabs (estimated from char count
//     using ELEVENLABS_COST_PER_1K_CHARS env, default 0.30).
//   • Persists timings jsonb: { story_ms, voiceover_ms,
//     render_ms, upload_ms, total_ms }.
//
// All Phase 1+3 fixes preserved.
// ═══════════════════════════════════════════════════════════
import { task, runs } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'
import { generateVideoStoryWithCost } from '@/lib/video/story-engine'
import type {
  VideoFormInput,
  VideoJobPayload,
  CTAScreen,
  StoryEngineResponse,
} from '@/types/video'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Supabase Storage bucket names ───────────────────────────
// `public` is NOT used as a bucket name — the URL path
// /storage/v1/object/public/<bucket>/... already contains 'public',
// so a bucket literally named `public` creates confusing //public/public//
// URLs and Supabase itself warns against it.
// (The `video-assets` bucket exists too — it holds admin-uploaded CTA
// images — but only the /generate route writes to it.)
const BUCKET_LOGOS         = 'logos'          // pre-uploaded logo assets
const BUCKET_VIDEO_RENDERS = 'video-renders'  // final MP4s, voiceovers (outputs)

// Configurable cost per 1K characters for ElevenLabs.
// multilingual_v2 is ~$0.30/1K chars at the Creator tier as of 2026.
function elevenLabsCostPer1K(): number {
  const raw = process.env.ELEVENLABS_COST_PER_1K_CHARS
  const parsed = raw ? parseFloat(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.30
}

async function resolveLogoUrl(theme: 'dark' | 'light'): Promise<string> {
  // Bucket: `logos` (public). Files at the bucket root.
  // "on-dark" = logo variant that reads on dark backgrounds (usually light-colored).
  // "on-light" = logo variant that reads on light backgrounds (usually dark-colored).
  const fileName = theme === 'dark'
    ? 'ascentor-color-on-dark.png'
    : 'ascentor-color-on-light.png'
  const { data } = supabase.storage
    .from(BUCKET_LOGOS)
    .getPublicUrl(fileName)
  return data.publicUrl
}

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
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.75,
          style:            0.3,
          use_speaker_boost: true,
        },
      }),
    }
  )
  if (!res.ok) {
    const errBody = await res.text().catch(() => '(no body)')
    throw new Error(`ElevenLabs error ${res.status}: ${errBody}`)
  }
  const buf = await res.arrayBuffer()
  const path = `${jobId}/voiceover.mp3`
  const { error } = await supabase.storage
    .from(BUCKET_VIDEO_RENDERS)
    .upload(path, new Uint8Array(buf), { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`Voiceover upload failed: ${error.message}`)
  return supabase.storage.from(BUCKET_VIDEO_RENDERS).getPublicUrl(path).data.publicUrl
}

async function resolveSoundtrack(mood: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('soundtracks')
    .select('file_url')
    .eq('mood', mood)
    .eq('active', true)

  if (error) {
    console.warn(`[video-generator] Soundtrack lookup failed for mood "${mood}":`, error.message)
    return null
  }
  if (!data || data.length === 0) {
    console.warn(`[video-generator] No active soundtrack for mood "${mood}" — rendering silent.`)
    return null
  }

  // Pick a random track from all active tracks for this mood
  const track = data[Math.floor(Math.random() * data.length)]
  console.log(`[video-generator] Picked soundtrack ${data.indexOf(track) + 1}/${data.length} for mood "${mood}"`)
  return track.file_url
}

async function renderVideo(payload: VideoJobPayload): Promise<Buffer> {
  const { bundle }                         = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')
  const path                               = await import('path')
  const os                                 = await import('os')
  const fs                                 = await import('fs')

  const bundleLocation = await bundle({
    entryPoint: path.resolve(process.cwd(), 'remotion/src/index.ts'),
    webpackOverride: (config) => config,
  })

  const composition = await selectComposition({
    serveUrl:   bundleLocation,
    id:         'AscentorKineticVideo',
    inputProps: payload as unknown as Record<string, unknown>,
  })

  const tmpFile = path.join(os.tmpdir(), `ascentor-${payload.jobId}.mp4`)

  try {
    await renderMedia({
      composition,
      serveUrl:       bundleLocation,
      codec:          'h264',
      outputLocation: tmpFile,
      inputProps:     payload as unknown as Record<string, unknown>,
      crf:            22,
      concurrency:    1,
      chromiumOptions: { disableWebSecurity: true, gl: 'angle' },
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 20 === 0) {
          console.log(`[video-generator] Render progress: ${Math.round(progress * 100)}%`)
        }
      },
    })
    return fs.readFileSync(tmpFile)
  } finally {
    try { fs.unlinkSync(tmpFile) } catch { /* already gone */ }
  }
}

// Helper: time an async step and return [result, elapsedMs]
async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now()
  const result = await fn()
  return [result, Date.now() - start]
}

// ══════════════════════════════════════════════════════════════
// MAIN TRIGGER.DEV TASK
// ══════════════════════════════════════════════════════════════
export const videoGeneratorTask = task({
  id: 'video-generator',
  machine: { preset: 'large-2x' },

  run: async (payload: {
    jobId:               string
    formInput:           VideoFormInput
    ctaImageStorageUrl?: string
    scheduleToBuffer?:   boolean
    bufferScheduledFor?: string
    presetStory?:        StoryEngineResponse
  }, { ctx }) => {
    const startTime = Date.now()
    const {
      jobId, formInput, ctaImageStorageUrl,
      scheduleToBuffer, bufferScheduledFor, presetStory,
    } = payload

    console.log(`[video-generator] Job ${jobId} started (run ${ctx.run.id}, preset: ${presetStory ? 'YES' : 'no'})`)

    // ── Store trigger_run_id + status=processing ─────────────
    // This runs even before any other work, so cancel/retry routes can find us.
    await supabase
      .from('video_jobs')
      .update({
        status:         'processing',
        started_at:     new Date().toISOString(),
        trigger_run_id: ctx.run.id,
      })
      .eq('id', jobId)

    const timings: Record<string, number> = {}
    let costUsdClaude:     number | null = null
    let costUsdElevenLabs: number | null = null

    try {
      // ── 1. Logo ──────────────────────────────────────────────
      const logoUrl = await resolveLogoUrl(formInput.theme)

      // ── 2. Story — from preset OR from Claude ────────────────
      let story: StoryEngineResponse
      if (presetStory) {
        console.log('[video-generator] Using admin-approved preset story — skipping Claude')
        story = presetStory
        timings.story_ms = 0
      } else {
        const [result, ms] = await timed(() => generateVideoStoryWithCost(formInput))
        story = result.story
        costUsdClaude = result.cost.costUsd
        timings.story_ms = ms
        console.log(`[video-generator] Story: ${ms}ms, $${costUsdClaude.toFixed(5)}`)
      }

      // ── Scene cap: max 8 scenes, max 7s each ─────────────────────────────
      // Speed control: multiply Claude's raw durationSeconds by SLOW so scenes
      // linger longer on screen. Claude now generates 4–5s baseline; after
      // the multiplier that becomes 7.2–9s, clamped to 7s max.
      //
      // Trigger.dev budget: 250s hard limit on large-2x.
      // Worst-case timing (8 scenes × 7s = 56s video + 8s CTA = 64s total):
      //   Story (Claude):  ~15s
      //   Render (Remotion, ~1920 frames @ ~75ms/frame): ~145s
      //   Voiceover + upload: ~20s
      //   Total: ~180s  →  safe margin of ~70s
      const SLOW = 1.8
      const RAW_SCENE_COUNT = story.scenes.length
      story.scenes = story.scenes
        .slice(0, 8)
        .map(s => ({ ...s, durationSeconds: Math.min(Math.round((s.durationSeconds * SLOW) * 10) / 10, 7) }))
      if (RAW_SCENE_COUNT !== story.scenes.length) {
        console.warn(
          `[video-generator] Scene cap applied: ${RAW_SCENE_COUNT} → ${story.scenes.length} scenes`
        )
      }

      // ── 3. Deterministic duration ────────────────────────────
      const CTA_DURATION_SECONDS = 8
      const totalDurationSeconds =
        story.scenes.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) +
        CTA_DURATION_SECONDS

      // ── 4. CTA screen ────────────────────────────────────────
      const ctaScreen: CTAScreen = {
        template:        formInput.ctaTemplate,
        headlineText:    story.ctaHeadline,
        subtitleText:    story.ctaSubtitle,
        buttonText:      formInput.ctaButtonText,
        buttonUrl:       formInput.ctaButtonUrl,
        imageUrl:        ctaImageStorageUrl,
        closingLine:     story.closingLine,
        durationSeconds: CTA_DURATION_SECONDS,
      }

      // ── 5. Audio ─────────────────────────────────────────────
      let voiceoverUrl:  string | undefined
      let soundtrackUrl: string | undefined

      if (formInput.audioMode === 'voiceover') {
        const [result, ms] = await timed(() => generateVoiceover(story.voiceoverScript, jobId))
        voiceoverUrl = result ?? undefined
        timings.voiceover_ms = ms

        // Estimate ElevenLabs cost from char count
        if (voiceoverUrl) {
          const chars = story.voiceoverScript.length
          const ratePer1K = elevenLabsCostPer1K()
          costUsdElevenLabs = (chars / 1000) * ratePer1K
          console.log(
            `[video-generator] Voiceover: ${ms}ms, ${chars} chars, ` +
            `est $${costUsdElevenLabs.toFixed(5)} (rate $${ratePer1K}/1K)`
          )
        }
      } else if (formInput.audioMode === 'soundtrack' && formInput.trackMood) {
        soundtrackUrl = (await resolveSoundtrack(formInput.trackMood)) ?? undefined
      }

      // ── 6. Build Remotion payload ────────────────────────────
      const videoPayload: VideoJobPayload = {
        jobId,
        theme:                formInput.theme,
        logoUrl,
        scenes:               story.scenes,
        ctaScreen,
        audioMode:            formInput.audioMode,
        trackMood:            formInput.trackMood,
        voiceoverScript:      story.voiceoverScript,
        totalDurationSeconds,
        voiceoverUrl,
        soundtrackUrl,
      }

      // ── 7. Render ────────────────────────────────────────────
      const [videoBuffer, renderMs] = await timed(() => renderVideo(videoPayload))
      timings.render_ms = renderMs
      console.log(`[video-generator] Render: ${renderMs}ms, ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`)

      // ── 8. Upload final MP4 ──────────────────────────────────
      const videoPath = `${jobId}/final.mp4`
      const [_uploadResult, uploadMs] = await timed(async () => {
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET_VIDEO_RENDERS)
          .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)
      })
      timings.upload_ms = uploadMs

      const { data: { publicUrl: finalVideoUrl } } = supabase.storage
        .from(BUCKET_VIDEO_RENDERS)
        .getPublicUrl(videoPath)

      // ── 9. Save to video_jobs ────────────────────────────────
      const durationMs = Date.now() - startTime
      timings.total_ms = durationMs

      const { error: saveErr } = await supabase
        .from('video_jobs')
        .update({
          status:                 'complete',
          video_url:              finalVideoUrl,
          voiceover_url:          voiceoverUrl  ?? null,
          soundtrack_url:         soundtrackUrl ?? null,
          scenes:                 story.scenes,
          cta_screen:             ctaScreen,
          voiceover_script:       story.voiceoverScript,
          total_duration_seconds: totalDurationSeconds,
          scene_count:            story.scenes.length,
          completed_at:           new Date().toISOString(),
          duration_ms:            durationMs,
          cost_usd_claude:        costUsdClaude,
          cost_usd_elevenlabs:    costUsdElevenLabs,
          timings,
        })
        .eq('id', jobId)
      if (saveErr) throw new Error(`Save failed: ${saveErr.message}`)

      // ── 10. Optionally queue to Buffer ───────────────────────
      if (scheduleToBuffer) {
        await supabase.from('social_queue').insert({
          content_type:  'video',
          platform:      'linkedin',
          content:       `${story.ctaHeadline}\n\n${story.ctaSubtitle}\n\n${formInput.ctaButtonUrl}`,
          video_url:     finalVideoUrl,
          status:        'pending',
          scheduled_for: bufferScheduledFor ?? null,
          source_job_id: jobId,
        })
      }

      console.log(
        `[video-generator] Job ${jobId} complete. ` +
        `${story.scenes.length} scenes · ${totalDurationSeconds}s · ${durationMs}ms · ` +
        `$${((costUsdClaude ?? 0) + (costUsdElevenLabs ?? 0)).toFixed(4)}`
      )

      return {
        success: true, jobId,
        videoUrl: finalVideoUrl,
        sceneCount: story.scenes.length,
        totalDurationSeconds,
        durationMs,
        costUsdTotal: (costUsdClaude ?? 0) + (costUsdElevenLabs ?? 0),
        usedPreset: !!presetStory,
      }

    } catch (err: any) {
      console.error(`[video-generator] Job ${jobId} failed:`, err.message)
      await supabase
        .from('video_jobs')
        .update({
          status:              'failed',
          error_message:       err.message ?? String(err),
          completed_at:        new Date().toISOString(),
          cost_usd_claude:     costUsdClaude,
          cost_usd_elevenlabs: costUsdElevenLabs,
          timings,
        })
        .eq('id', jobId)
      throw err
    }
  },
})
