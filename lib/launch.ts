// lib/launch.ts
// Single switch for "is the member platform open to the public?".
//
//   `npm run dev` (NODE_ENV=development)   always open: /login and /signup work, no gate
//   production build, NEXT_PUBLIC_PLATFORM_OPEN=true   open (set only on a deliberate launch)
//   production build, variable unset                   closed: /login and /signup bounce to the
//                                                      home page with the "something is coming" gate
//
// So local work is never gated, and production (main, and any deployed build) stays closed
// unless the variable is set on purpose. NEXT_PUBLIC_ so the edge proxy and browser agree.
export const platformOpen = (): boolean =>
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_PLATFORM_OPEN === 'true';
