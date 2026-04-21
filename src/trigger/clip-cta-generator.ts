// ═══════════════════════════════════════════════════════════
// Ascentor Clip+CTA Generator — Trigger.dev Task
// Drop in: src/trigger/clip-cta-generator.ts
//
// Pipeline:
//   1. Probe source clip (ffprobe) → get dimensions + duration
//   2. Render CTA scene via Remotion (CTAOnlyComposition)
//   3. Stitch: source clip + transition + CTA via FFmpeg
//   4. Upload final MP4 → video-renders bucket
//   5. Update clip_cta_jobs row → complete
//
// FFmpeg is installed into the build image by the Trigger.dev ffmpeg() build
// extension (trigger.config.ts). It sets FFMPEG_PATH and FFPROBE_PATH env vars
// automatically — no npm packages needed.
// ═══════════════════════════════════════════════════════════
import { task } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'
import type { ClipCTATaskPayload } from '@/types/clip-cta'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET_LOGOS   = 'logos'
const BUCKET_RENDERS = 'video-renders'
const BUCKET_CLIPS   = 'clip-uploads'

// ── Resolve logo URL (same pattern as kinetic video) ────────
async function resolveLogoUrl(): Promise<string> {
  const { data } = supabase.storage
    .from(BUCKET_LOGOS)
    .getPublicUrl('ascentor-color-on-dark.png')
  return data.publicUrl
}

// ── Download a Supabase public URL to a temp file ────────────
async function downloadToFile(url: string, destPath: string): Promise<void> {
  const fs   = await import('fs')
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`)
  const buf  = await res.arrayBuffer()
  fs.writeFileSync(destPath, new Uint8Array(buf))
}

// ── Probe video dimensions + duration via ffprobe ────────────
async function probeVideo(filePath: string): Promise<{
  width: number
  height: number
  durationS: number
  hasAudio: boolean
}> {
  const { execSync } = await import('child_process')
  // FFPROBE_PATH is set by the Trigger.dev ffmpeg() build extension
  const ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe'

  const raw = execSync(
    `"${ffprobePath}" -v quiet -print_format json -show_streams -show_format "${filePath}"`
  ).toString()

  const info  = JSON.parse(raw)
  const video = info.streams.find((s: any) => s.codec_type === 'video')
  const audio = info.streams.find((s: any) => s.codec_type === 'audio')

  if (!video) throw new Error('No video stream found in clip')

  const durationS = parseFloat(info.format?.duration ?? video.duration ?? '0')

  return {
    width:     video.width  as number,
    height:    video.height as number,
    durationS: Math.round(durationS * 10) / 10,
    hasAudio:  !!audio,
  }
}

// ── Render CTA scene via Remotion ────────────────────────────
async function renderCTA(
  jobId:    string,
  props:    Record<string, unknown>,
  width:    number,
  height:   number,
  durationS: number,
): Promise<string> {
  const { bundle }                         = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')
  const path                               = await import('path')
  const os                                 = await import('os')
  const fs                                 = await import('fs')

  const bundleLocation = await bundle({
    entryPoint: path.resolve(process.cwd(), 'remotion/src/index.ts'),
    webpackOverride: (config: any) => config,
  })

  const composition = await selectComposition({
    serveUrl:   bundleLocation,
    id:         'CTAOnlyComposition',
    inputProps: {
      ...props,
      width,
      height,
      durationS,
    },
  })

  const tmpFile = path.join(os.tmpdir(), `ascentor-cta-${jobId}.mp4`)

  try {
    await renderMedia({
      composition,
      serveUrl:       bundleLocation,
      codec:          'h264',
      outputLocation: tmpFile,
      inputProps:     { ...props, width, height, durationS },
      crf:            22,
      concurrency:    1,
      chromiumOptions: { disableWebSecurity: true, gl: 'angle' },
    })
    return tmpFile
  } catch (err) {
    try { fs.unlinkSync(tmpFile) } catch { /* gone */ }
    throw err
  }
}

// ── Stitch clip + transition + CTA via FFmpeg ────────────────
async function stitchVideos(params: {
  jobId:          string
  clipPath:       string
  ctaPath:        string
  transitionType: 'fade-black' | 'crossfade' | 'hard-cut'
  clipDurationS:  number
  ctaDurationS:   number
  hasAudio:       boolean
}): Promise<string> {
  const { jobId, clipPath, ctaPath, transitionType, clipDurationS, ctaDurationS, hasAudio } = params
  const path  = await import('path')
  const os    = await import('os')
  const fs    = await import('fs')
  const { execSync } = await import('child_process')

  // FFMPEG_PATH is set by the Trigger.dev ffmpeg() build extension
  const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg'

  const outPath = path.join(os.tmpdir(), `ascentor-final-${jobId}.mp4`)

  // Transition duration: 0.5s for fade/crossfade, 0 for hard cut
  const TRANS_S = transitionType === 'hard-cut' ? 0 : 0.5

  let cmd: string

  if (transitionType === 'hard-cut') {
    // Simple concat — no transition
    const listFile = path.join(os.tmpdir(), `concat-${jobId}.txt`)
    fs.writeFileSync(listFile, `file '${clipPath}'\nfile '${ctaPath}'\n`)
    cmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${listFile}" -c copy "${outPath}"`

  } else if (transitionType === 'fade-black') {
    // Fade clip to black, CTA fades in from black
    // Audio: fade out at end of clip, fade in at start of CTA
    const clipFadeStart = clipDurationS - TRANS_S

    if (hasAudio) {
      cmd = `"${ffmpegPath}" -y \
        -i "${clipPath}" -i "${ctaPath}" \
        -filter_complex "\
          [0:v]fade=t=out:st=${clipFadeStart}:d=${TRANS_S}[v0]; \
          [1:v]fade=t=in:st=0:d=${TRANS_S}[v1]; \
          [v0][v1]concat=n=2:v=1:a=0[vout]; \
          [0:a]afade=t=out:st=${clipFadeStart}:d=${TRANS_S}[a0]; \
          [a0]apad=pad_dur=${ctaDurationS}[aout]" \
        -map "[vout]" -map "[aout]" \
        -c:v libx264 -crf 22 -preset fast -c:a aac -b:a 192k \
        "${outPath}"`
    } else {
      cmd = `"${ffmpegPath}" -y \
        -i "${clipPath}" -i "${ctaPath}" \
        -filter_complex "\
          [0:v]fade=t=out:st=${clipFadeStart}:d=${TRANS_S}[v0]; \
          [1:v]fade=t=in:st=0:d=${TRANS_S}[v1]; \
          [v0][v1]concat=n=2:v=1:a=0[vout]" \
        -map "[vout]" \
        -c:v libx264 -crf 22 -preset fast \
        "${outPath}"`
    }

  } else {
    // crossfade — xfade filter
    const xfadeOffset = Math.max(0, clipDurationS - TRANS_S)

    if (hasAudio) {
      cmd = `"${ffmpegPath}" -y \
        -i "${clipPath}" -i "${ctaPath}" \
        -filter_complex "\
          [0:v][1:v]xfade=transition=fade:duration=${TRANS_S}:offset=${xfadeOffset}[vout]; \
          [0:a]afade=t=out:st=${xfadeOffset}:d=${TRANS_S}[a0]; \
          [a0]apad=pad_dur=${ctaDurationS}[aout]" \
        -map "[vout]" -map "[aout]" \
        -c:v libx264 -crf 22 -preset fast -c:a aac -b:a 192k \
        "${outPath}"`
    } else {
      cmd = `"${ffmpegPath}" -y \
        -i "${clipPath}" -i "${ctaPath}" \
        -filter_complex "\
          [0:v][1:v]xfade=transition=fade:duration=${TRANS_S}:offset=${xfadeOffset}[vout]" \
        -map "[vout]" \
        -c:v libx264 -crf 22 -preset fast \
        "${outPath}"`
    }
  }

  console.log(`[clip-cta] FFmpeg stitch (${transitionType})`)
  execSync(cmd, { stdio: 'pipe' })

  return outPath
}

// ══════════════════════════════════════════════════════════════
// MAIN TRIGGER.DEV TASK
// ══════════════════════════════════════════════════════════════
export const clipCTAGeneratorTask = task({
  id:      'clip-cta-generator',
  machine: { preset: 'large-2x' },

  run: async (payload: ClipCTATaskPayload, { ctx }) => {
    const startTime = Date.now()
    const { jobId, clipUrl, ctaImageUrl, formInput } = payload

    console.log(`[clip-cta] Job ${jobId} started (run ${ctx.run.id})`)

    // Mark processing
    await supabase
      .from('clip_cta_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString(), trigger_run_id: ctx.run.id })
      .eq('id', jobId)

    const os   = await import('os')
    const fs   = await import('fs')
    const path = await import('path')

    const clipPath = path.join(os.tmpdir(), `clip-${jobId}.mp4`)
    let   ctaRenderedPath = ''
    let   outPath  = ''

    try {
      // ── 1. Download source clip ──────────────────────────────
      console.log('[clip-cta] Downloading source clip…')
      await downloadToFile(clipUrl, clipPath)

      // ── 2. Probe clip ────────────────────────────────────────
      const { width, height, durationS, hasAudio } = await probeVideo(clipPath)
      console.log(`[clip-cta] Clip: ${width}×${height}, ${durationS}s, audio: ${hasAudio}`)

      // Persist dimensions to job row
      await supabase
        .from('clip_cta_jobs')
        .update({ clip_duration_s: durationS, clip_width: width, clip_height: height })
        .eq('id', jobId)

      // ── 3. Render CTA composition ────────────────────────────
      const logoUrl = await resolveLogoUrl()

      const ctaProps: Record<string, unknown> = {
        jobId,
        template:    formInput.ctaTemplate,
        durationS:   formInput.ctaDurationS,
        width,
        height,
        logoUrl,
        headline:    formInput.ctaHeadline   ?? '',
        subtitle:    formInput.ctaSubtitle   ?? '',
        buttonText:  formInput.ctaButtonText ?? '',
        buttonUrl:   formInput.ctaButtonUrl  ?? '',
        closingLine: formInput.ctaClosingLine ?? '',
        imageUrl:    ctaImageUrl             ?? '',
      }

      console.log('[clip-cta] Rendering CTA…')
      // renderCTA returns the temp file path it wrote to
      ctaRenderedPath = await renderCTA(jobId, ctaProps, width, height, formInput.ctaDurationS)

      // ── 4. Stitch ────────────────────────────────────────────
      console.log(`[clip-cta] Stitching (${formInput.transitionType})…`)
      outPath = await stitchVideos({
        jobId,
        clipPath,
        ctaPath:        ctaRenderedPath,
        transitionType: formInput.transitionType,
        clipDurationS:  durationS,
        ctaDurationS:   formInput.ctaDurationS,
        hasAudio,
      })

      // ── 5. Upload final MP4 ──────────────────────────────────
      const videoPath = `${jobId}/final.mp4`
      const videoBuffer = fs.readFileSync(outPath)

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_RENDERS)
        .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

      const { data: { publicUrl: finalVideoUrl } } = supabase.storage
        .from(BUCKET_RENDERS)
        .getPublicUrl(videoPath)

      // ── 6. Mark complete ─────────────────────────────────────
      const durationMs = Date.now() - startTime
      await supabase
        .from('clip_cta_jobs')
        .update({
          status:       'complete',
          video_url:    finalVideoUrl,
          completed_at: new Date().toISOString(),
          duration_ms:  durationMs,
        })
        .eq('id', jobId)

      console.log(`[clip-cta] Job ${jobId} complete in ${(durationMs / 1000).toFixed(1)}s`)

      return { success: true, jobId, videoUrl: finalVideoUrl, durationMs }

    } catch (err: any) {
      console.error(`[clip-cta] Job ${jobId} failed:`, err.message)
      await supabase
        .from('clip_cta_jobs')
        .update({
          status:        'failed',
          error_message: err.message ?? String(err),
          completed_at:  new Date().toISOString(),
        })
        .eq('id', jobId)
      throw err

    } finally {
      // Clean up temp files
      for (const f of [clipPath, ctaRenderedPath, outPath]) {
        if (f) try { fs.unlinkSync(f) } catch { /* already gone */ }
      }
    }
  },
})
