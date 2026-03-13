// app/partner/ai-persona/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Partner can configure their AI coach's persona here.
// This replaces the hardcoded system prompt in /api/coach/session/route.ts
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';

const DEFAULT_PERSONA = `You are an expert leadership coach for professionals in [YOUR INDUSTRY/MARKET].
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Be culturally aware of [YOUR CULTURAL CONTEXT] and the career challenges your users face.`;

const PERSONA_TEMPLATES = [
  {
    name: 'African Professionals (default)',
    prompt: `You are an expert leadership coach for African professionals aged 20-40.
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Be culturally aware of hierarchical cultures, ethnic/family networks,
and that career decisions carry higher economic stakes.`,
  },
  {
    name: 'Tech & Startup',
    prompt: `You are an expert coach for tech founders and product professionals.
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Be direct, first-principles focused. Users move fast and value clarity over comfort.`,
  },
  {
    name: 'Corporate Leadership',
    prompt: `You are an executive coach for corporate leaders navigating organisational complexity.
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Focus on stakeholder management, influence without authority, and long-term career capital.`,
  },
  {
    name: 'Healthcare Professionals',
    prompt: `You are a career coach for healthcare professionals balancing clinical excellence with leadership growth.
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Respect the weight of clinical responsibility and the unique pressures of the healthcare environment.`,
  },
];

export default function AIPersonaPage() {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partner/brand')
      .then((r) => r.json())
      .then((data) => {
        const brand = data.brand || {};
        setPrompt(brand.ai_persona_prompt || data.ai_persona_prompt || DEFAULT_PERSONA);
        setLoading(false);
      })
      .catch(() => {
        setPrompt(DEFAULT_PERSONA);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/partner/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_persona_prompt: prompt }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '6px' }}>
        AI Coach Persona
      </h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>
        This system prompt defines how your AI coach thinks, speaks, and what it focuses on.
        Changes take effect immediately for all new sessions.
      </p>

      {/* Templates */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
          Quick-start templates
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PERSONA_TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => setPrompt(t.prompt)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt editor */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          System prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '14px 16px',
            color: '#f8fafc',
            fontSize: '13px',
            lineHeight: 1.7,
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
          The output format instructions (reflection/question/action XML tags) are appended
          automatically — you only need to define the coach&apos;s role and context here.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            background: '#14b8a6',
            color: '#000',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save persona'}
        </button>

        {saved && (
          <span style={{ fontSize: '13px', color: '#4ade80' }}>
            ✓ Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
