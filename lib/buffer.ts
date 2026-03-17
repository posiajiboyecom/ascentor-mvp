/**
 * Buffer API Integration for Ascentor
 * Docs: https://buffer.com/developers/api
 *
 * Usage:
 *   - Schedule posts to Instagram, TikTok, LinkedIn from one place
 *   - Used by the Ascentor admin content scheduler
 */

const BUFFER_API = 'https://api.bufferapp.com/1'
const ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN!

// ─── Types ────────────────────────────────────────────────────────────────────

export type BufferProfile = {
  id: string
  service: 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | string
  service_username: string
  avatar: string
  formatted_username: string
}

export type SchedulePostParams = {
  profileIds: string[]        // Buffer profile IDs to post to
  text: string                // Caption / post body
  mediaUrls?: string[]        // Public image/video URLs (must be publicly accessible)
  scheduledAt?: Date          // If omitted, adds to Buffer queue
  hashtags?: string[]         // Will be appended to text
}

export type BufferPost = {
  id: string
  status: 'buffer' | 'sent' | 'failed'
  text: string
  scheduled_at: number        // Unix timestamp
  profile_id: string
  service_type: string
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

async function bufferFetch<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${BUFFER_API}${endpoint}.json`

  const formBody = body
    ? new URLSearchParams({
        access_token: ACCESS_TOKEN,
        ...Object.fromEntries(
          Object.entries(body).map(([k, v]) => [
            k,
            typeof v === 'object' ? JSON.stringify(v) : String(v),
          ])
        ),
      }).toString()
    : `access_token=${ACCESS_TOKEN}`

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? formBody : undefined,
    cache: 'no-store',
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Buffer API error ${res.status}: ${error}`)
  }

  return res.json() as Promise<T>
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all connected social profiles on your Buffer account
 */
export async function getProfiles(): Promise<BufferProfile[]> {
  const data = await bufferFetch<{ profiles: BufferProfile[] }>('/profiles')
  return data.profiles ?? []
}

/**
 * Schedule or queue a post to one or more profiles
 *
 * @example
 * await schedulePost({
 *   profileIds: ['instagram_profile_id'],
 *   text: 'Nobody told you that landing the big job was only the beginning.',
 *   mediaUrls: ['https://ascentorbi.com/assets/post-image.jpg'],
 *   scheduledAt: new Date('2026-03-18T07:30:00+01:00'),
 *   hashtags: ['#AfricanProfessionals', '#NigerianCareer', '#AICoaching'],
 * })
 */
export async function schedulePost(params: SchedulePostParams): Promise<BufferPost[]> {
  const { profileIds, text, mediaUrls, scheduledAt, hashtags } = params

  const fullText = hashtags?.length
    ? `${text}\n\n${hashtags.join(' ')}`
    : text

  const body: Record<string, unknown> = {
    text: fullText,
    profile_ids: profileIds,
    shorten: false,
  }

  if (scheduledAt) {
    body.scheduled_at = scheduledAt.toISOString()
  }

  if (mediaUrls?.length) {
    body.media = { photo: mediaUrls[0] }   // Buffer accepts one media per post
  }

  const data = await bufferFetch<{ updates: BufferPost[] }>(
    '/updates/create',
    'POST',
    body
  )

  return data.updates ?? []
}

/**
 * Get scheduled / queued posts for a profile
 */
export async function getPendingPosts(profileId: string): Promise<BufferPost[]> {
  const data = await bufferFetch<{ updates: BufferPost[] }>(
    `/profiles/${profileId}/updates/pending`
  )
  return data.updates ?? []
}

/**
 * Delete a scheduled post by its Buffer update ID
 */
export async function deletePost(updateId: string): Promise<boolean> {
  const data = await bufferFetch<{ success: boolean }>(
    `/updates/${updateId}/destroy`,
    'POST'
  )
  return data.success ?? false
}

/**
 * Get the posting schedule/times for a profile
 */
export async function getPostingSchedule(profileId: string) {
  return bufferFetch(`/profiles/${profileId}/schedules`)
}
