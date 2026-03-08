'use client';

import { useRouter } from 'next/navigation';

// ============================================================
// FEATURE #10: Back / Return Button Component
// Add to top of Settings page and other inner pages
// Usage: <BackButton /> or <BackButton label="Back to Dashboard" href="/dashboard" />
// ============================================================

interface BackButtonProps {
  /** Custom label — defaults to "Back" */
  label?: string;
  /** Explicit route — if not set, uses router.back() */
  href?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export default function BackButton({ label = 'Back', href, style }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        color: 'var(--text-muted, #C5C4BF)',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        padding: '8px 12px 8px 8px',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
        marginBottom: '16px',
        ...style,
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.color = 'var(--text, #F1F0EB)';
        btn.style.background = 'var(--bg-input, #1A1D2E)';
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.color = 'var(--text-muted, #C5C4BF)';
        btn.style.background = 'none';
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      {label}
    </button>
  );
}
