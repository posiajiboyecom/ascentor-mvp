'use client';

import { useState } from 'react';

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

// Strength uses brand secondary colors progressively
function getStrength(password: string): {
  score: number; label: string; color: string; bg: string;
} {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password))   score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
  if (score <= 2) return { score, label: 'Fair',   color: '#FD81FD', bg: 'rgba(253,129,253,0.12)' };  // fuchsia
  if (score <= 3) return { score, label: 'Good',   color: '#A6A2FF', bg: 'rgba(166,162,255,0.12)' };  // purple light
  if (score <= 4) return { score, label: 'Strong', color: '#CFFF5E', bg: 'rgba(207,255,94,0.12)' };   // lime
  return               { score, label: 'Rock solid', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
}

// Bar colors per segment — uses the brand palette
const BAR_COLORS = ['#EF4444', '#FD81FD', '#A6A2FF', '#CFFF5E', '#10B981'];

export default function PasswordInput({
  value, onChange,
  placeholder = 'Enter password',
  name, id, required = false, autoComplete,
  disabled = false, className, style,
  showStrength = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const strength = showStrength && value.length > 0 ? getStrength(value) : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        name={name} id={id} required={required}
        autoComplete={autoComplete} disabled={disabled}
        className={className}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '10px 44px 10px 14px',
          borderRadius: 9,
          border: `1px solid ${focused ? '#6662FF' : 'var(--border)'}`,
          boxShadow: focused ? '0 0 0 3px rgba(102,98,255,0.15)' : 'none',
          background: 'var(--bg-input)',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.18s, box-shadow 0.18s',
          fontFamily: 'Inter, sans-serif',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          ...style,
        }}
      />

      {/* Show/hide toggle */}
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 10,
          top: strength ? '22px' : '50%',
          transform: strength ? 'none' : 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center',
          color: focused ? '#6662FF' : 'var(--text-dim)',
          transition: 'color 0.18s',
        }}
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
        <div style={{ marginTop: 8 }}>
          {/* Segmented bars — each uses a different brand color */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {[1, 2, 3, 4, 5].map(level => (
              <div key={level} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: level <= strength.score ? BAR_COLORS[level - 1] : 'var(--border)',
                transition: 'background 0.3s ease',
              }} />
            ))}
          </div>
          {/* Label badge */}
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            color: strength.color,
            background: strength.bg,
            border: `1px solid ${strength.color}30`,
            padding: '2px 10px', borderRadius: 100,
            display: 'inline-block', letterSpacing: '0.03em',
          }}>
            {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}
