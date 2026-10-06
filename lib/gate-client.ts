'use client';

// lib/gate-client.ts
// What a "Join" / "Sign in" call to action does. While the platform is closed
// (see lib/launch.ts) it shows the gate modal; once open it goes to /signup.
import { platformOpen } from '@/lib/launch';

export function openGateOrSignup(): void {
  if (platformOpen()) {
    window.location.assign('/signup');
    return;
  }
  window.dispatchEvent(new Event('community-gate'));
}
