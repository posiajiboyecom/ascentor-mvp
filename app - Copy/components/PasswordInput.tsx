'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · PasswordInput · Brand Book v1.0 · 2026
// Drop-in replacement for <input type="password" />
// Usage: <PasswordInput value={pw} onChange={setPw} placeholder="..." />
// Gold: #E8A020  Dark: #0C0B08  Font: Syne
// ─────────────────────────────────────────────────────────────────

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showStrength?: boolean;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password))                               score++;
  if (/[^a-zA-Z0-9]/.test(password))                    score++;

  if (score <= 1) return { score, label: 'Weak',   color: '#EF4444' };
  if (score <= 2) return { score, label: 'Fair',   color: '#F97316' };
  if (score <= 3) return { score, label: 'Good',   color: '#E8A020' };
  return               { score, label: 'Strong', color: '#10B981' };
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  name,
  id,
  required   = false,
  autoComplete,
  disabled   = false,
  className,
  style,
  showStrength = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength && value.length > 0 ? getStrength(value) : null;

  const inputStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '13px 44px 13px 16px',
    borderRadius:    '10px',
    border:          '1px solid rgba(212,207,195,0.10)',
    background:      '#1E1C17',
    color:           '#F7F6F3',
    fontFamily:      "'Syne', system-ui, sans-serif",
    fontSize:        '14px',
    fontWeight:      400,
    outline:         'none',
    boxSizing:       'border-box',
    transition:      'border-color 0.15s ease',
    ...style,
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        name={name}
        id={id}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        className={className}
        style={inputStyle}
        onFocus={(e)  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(232,160,32,0.35)'; }}
        onBlur={(e)   => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,207,195,0.10)'; }}
      />

      {/* Show/Hide toggle */}
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position:   'absolute',
          right:      '12px',
          top:        showStrength && strength ? 'calc(50% - 10px)' : '50%',
          transform:  'translateY(-50%)',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    '4px',
          display:    'flex',
          alignItems: 'center',
          color:      '#4A4438',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#7A7260'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#4A4438'; }}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>

      {/* Strength meter */}
      {showStrength && strength && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                style={{
                  flex:         1,
                  height:       '2px',
                  borderRadius: '2px',
                  background:   level <= strength.score ? strength.color : 'rgba(212,207,195,0.10)',
                  transition:   'background 0.3s ease',
                }}
              />
            ))}
          </div>
          <span style={{
            fontFamily:  "'DM Mono', 'Courier New', monospace",
            fontSize:    '10px',
            fontWeight:  500,
            color:       strength.color,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
          }}>
            {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}
