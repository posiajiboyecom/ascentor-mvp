'use client';

// Reusable button that fires the community-gate modal without navigating.
// Use this anywhere a server component needs a "Join Community" / "Sign Up" CTA.

interface GateButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function GateButton({ children, className, style }: GateButtonProps) {
  return (
    <button
      className={className}
      style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, ...style }}
      onClick={() => window.dispatchEvent(new Event('community-gate'))}
    >
      {children}
    </button>
  );
}
