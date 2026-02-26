'use client';

import { useState } from 'react';

// ============================================================
// FEATURE #9: Password Input with Show/Hide Toggle
// Drop-in replacement for <input type="password" />
// Usage: <PasswordInput value={pw} onChange={setPw} placeholder="..." />
// ============================================================

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
  /** Show password strength meter below input */
  showStrength?: boolean;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'var(--error, #EF4444)' };
  if (score <= 2) return { score, label: 'Fair', color: '#F97316' };
  if (score <= 3) return { score, label: 'Good', color: 'var(--accent, #F59E0B)' };
  return { score, label: 'Strong', color: 'var(--success, #10B981)' };
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  name,
  id,
  required = false,
  autoComplete,
  disabled = false,
  className,
  style,
  showStrength = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength && value.length > 0 ? getStrength(value) : null;

  const defaultStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 44px 10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border, #2A2D3A)',
    background: 'var(--bg-input, #1A1D2E)',
    color: 'var(--text, #F1F0EB)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
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
        style={defaultStyle}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--accent, #F59E0B)';
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--border, #2A2D3A)';
        }}
      />

      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: '10px',
          top: showStrength && strength ? 'calc(50% - 10px)' : '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim, #5A5955)',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted, #C5C4BF)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim, #5A5955)';
        }}
      >
        {visible ? (
          // Eye-off icon (password visible, click to hide)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          // Eye icon (password hidden, click to show)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>

      {/* Strength Meter */}
      {showStrength && strength && (
        <div style={{ marginTop: '6px' }}>
          <div style={{
            display: 'flex',
            gap: '3px',
            marginBottom: '4px',
          }}>
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                style={{
                  flex: 1,
                  height: '3px',
                  borderRadius: '2px',
                  background: level <= strength.score
                    ? strength.color
                    : 'var(--border, #2A2D3A)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
          <span style={{
            fontSize: '11px',
            color: strength.color,
            fontWeight: 500,
          }}>
            {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}
