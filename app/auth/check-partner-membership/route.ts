// Older address for the sign-in callback. Everything, including the partner whitelist check, now lives in
// /auth/callback (lib/auth/complete-signin.ts), so this route hands over to it. Kept so old links keep working.
export { GET } from '@/app/auth/callback/route';
