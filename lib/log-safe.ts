// lib/log-safe.ts
// Log helpers with no server-only import, so they also work inside Trigger.dev tasks and scripts.

/** Keeps logs useful without writing full addresses into them: "ada@example.com" -> "a***@example.com". */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(none)';
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}
