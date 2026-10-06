'use client';

// Reusable button that fires the community-gate modal without navigating.
// Use this anywhere a server component needs a "Join Community" / "Sign Up" CTA.

interface GateButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

import { platformOpen } from '@/lib/launch';

export default function GateButton({ children, className, style }: GateButtonProps) {
  return (
    <button
      className={className}
      style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, ...style }}
      onClick={() => {
        // When the platform is open the CTA is a real sign-up; otherwise it shows the gate modal.
        if (platformOpen()) window.location.assign('/signup');
        else window.dispatchEvent(new Event('community-gate'));
      }}
    >
      {children}
    </button>
  );
}
