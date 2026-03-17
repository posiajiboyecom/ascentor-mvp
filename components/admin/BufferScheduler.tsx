'use client'

import { useState, useEffect } from 'react'

type BufferProfile = {
  id: string
  service: string
  service_username: string
  formatted_username: string
  avatar: string
}

const HASHTAG_STACKS = {
  'Pain point / story': '#AfricanProfessionals #NigerianCareer #CareerGrowth #CareerAdvice #AICoaching #LeadershipDevelopment #Nigeria #StuckAchiever #CareerTips #NaijaHustle #ProfessionalDevelopment #NigerianLeader',
  'Build in public': '#BuildInPublic #NigerianFounder #FounderLife #AICoaching #CareerAI #AscentorAI #AfricanProfessionals #NigerianCareer #Entrepreneurship #TechAfrica #DigitalCoaching #Lagos',
  'Social proof': '#AICoaching #CareerCoaching #DigitalCoaching #AfricanProfessionals #CareerGrowth #NigerianLeader #LeadershipDevelopment #AscentorAI #CareerAI #ProfessionalDevelopment',
  'Educational carousel': '#CareerTips #NigerianLeader #AfricaLeadership #CareerGrowth #ProfessionalDevelopment #StuckAchiever #AfricanProfessionals #LeadershipDevelopment #CareerAdvice #MidCareerNigeria',
  'TikTok': '#CareerTok #AfricanProfessionals #NigerianCareer #CareerAdvice #AICoaching #GrowthMindset #CareerGrowth #NaijaHustle #ProfessionalDevelopment #CareerChange #FounderLife #Nigeria #Fyp',
}

export default function BufferScheduler() {
  const [profiles, setProfiles] = useState<BufferProfile[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [text, setText] = useState('')
  const [hashtagStack, setHashtagStack] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const charCount = text.length + (hashtagStack ? '\n\n'.length + hashtagStack.length : 0)

  useEffect(() => {
    fetch('/api/buffer/profiles')
      .then(r => r.json())
      .then(d => { setProfiles(d.profiles ?? []); setProfilesLoading(false) })
      .catch(() => setProfilesLoading(false))
  }, [])

  function toggleProfile(id: string) {
    setSelectedProfiles(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleSchedule() {
    if (!text.trim() || selectedProfiles.length === 0) return
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/buffer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileIds: selectedProfiles,
          text: text.trim(),
          hashtags: hashtagStack ? hashtagStack.split(' ').filter(Boolean) : [],
          scheduledAt: scheduledAt || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: data.message })
      setText('')
      setScheduledAt('')
      setHashtagStack('')
      setSelectedProfiles([])
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to schedule post' })
    } finally {
      setLoading(false)
    }
  }

  const serviceIcon: Record<string, string> = {
    instagram: 'IG',
    tiktok: 'TK',
    linkedin: 'LI',
    twitter: 'TW',
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 0' }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Schedule post</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        Write once, post to all your connected channels via Buffer.
      </p>

      {/* Profile selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
          Channels
        </label>
        {profilesLoading ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading profiles…</p>
        ) : profiles.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            No Buffer profiles found. Connect your social accounts at{' '}
            <a href="https://buffer.com" target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-info)' }}>
              buffer.com
            </a>
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => toggleProfile(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 20, fontSize: 13,
                  border: `0.5px solid ${selectedProfiles.includes(p.id) ? 'var(--color-border-info)' : 'var(--color-border-secondary)'}`,
                  background: selectedProfiles.includes(p.id) ? 'var(--color-background-info)' : 'transparent',
                  color: selectedProfiles.includes(p.id) ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 11 }}>{serviceIcon[p.service] ?? p.service.slice(0,2).toUpperCase()}</span>
                {p.formatted_username}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Post body */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Caption
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Nobody told you that landing the big job was only the beginning…"
          rows={6}
          style={{ width: '100%', resize: 'vertical', fontSize: 14, lineHeight: 1.6 }}
        />
        <div style={{ fontSize: 12, color: charCount > 2200 ? 'var(--color-text-danger)' : 'var(--color-text-secondary)', textAlign: 'right', marginTop: 4 }}>
          {charCount} / 2200
        </div>
      </div>

      {/* Hashtag stack selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Hashtag stack
        </label>
        <select
          value={hashtagStack}
          onChange={e => setHashtagStack(e.target.value)}
          style={{ width: '100%', fontSize: 13 }}
        >
          <option value="">No hashtags</option>
          {Object.entries(HASHTAG_STACKS).map(([label, tags]) => (
            <option key={label} value={tags}>{label}</option>
          ))}
        </select>
        {hashtagStack && (
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            {hashtagStack}
          </p>
        )}
      </div>

      {/* Schedule time */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Schedule date/time <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(optional — leave blank to add to queue)</span>
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* Submit */}
      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
          background: message.type === 'success' ? 'var(--color-background-success)' : 'var(--color-background-danger)',
          color: message.type === 'success' ? 'var(--color-text-success)' : 'var(--color-text-danger)',
          border: `0.5px solid ${message.type === 'success' ? 'var(--color-border-success)' : 'var(--color-border-danger)'}`,
        }}>
          {message.text}
        </div>
      )}

      <button
        onClick={handleSchedule}
        disabled={loading || !text.trim() || selectedProfiles.length === 0}
        style={{
          padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading || !text.trim() || selectedProfiles.length === 0 ? 0.5 : 1,
        }}
      >
        {loading ? 'Scheduling…' : scheduledAt ? 'Schedule post' : 'Add to Buffer queue'}
      </button>
    </div>
  )
}
