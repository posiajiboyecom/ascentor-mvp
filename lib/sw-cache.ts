// Privacy on shared devices. The service worker (v6) saves only static assets and the offline page, never a member
// page or API response. On sign-out, and when a different account signs in on the same device, we still ask it to
// delete any page cache an older worker left behind, and we clear this account's unsent outbox items.

export async function clearUserCache(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await Promise.race([
      navigator.serviceWorker.getRegistration(),
      new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500)),
    ]);
    const target = navigator.serviceWorker.controller ?? reg?.active ?? null;
    target?.postMessage({ type: 'clear-user-cache' });
  } catch { /* nothing to clear */ }
  try { const { clearOutbox } = await import('@/lib/outbox'); await clearOutbox(); } catch { /* nothing queued */ }
}

const LAST_USER_KEY = 'ascentor:last-user';

/** Call when the signed-in user is known. Clears leftovers if it is a different account from last time. */
export function noteSignedInUser(userId: string | null | undefined): void {
  try {
    if (!userId) return;
    const prev = localStorage.getItem(LAST_USER_KEY);
    if (prev && prev !== userId) void clearUserCache();
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch { /* storage blocked */ }
}
