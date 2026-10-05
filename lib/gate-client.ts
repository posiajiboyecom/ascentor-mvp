'use client';

// lib/gate-client.ts
// What a "Join" / "Sign in" call to action does. While the platform is closed
// (see lib/launch.ts) it shows the gate modal; once open it goes to /signup.
export function openGateOrSignup(): void {
  if (process.env.NEXT_PUBLIC_PLATFORM_OPEN === 'true') {
    window.location.assign('/signup');
    return;
  }
  window.dispatchEvent(new Event('community-gate'));
}
