// lib/launch.ts
// Single switch for "is the member platform open to the public?".
//
//   NEXT_PUBLIC_PLATFORM_OPEN=true   /login and /signup work, gate modal is bypassed
//   unset / anything else            /login and /signup bounce to the home page with the
//                                    "something is coming" gate (production default)
//
// It is a NEXT_PUBLIC_ variable so the edge proxy and the browser agree. Production
// stays closed simply by not setting it; development and staging set it to "true".
export const platformOpen = (): boolean => process.env.NEXT_PUBLIC_PLATFORM_OPEN === 'true';
