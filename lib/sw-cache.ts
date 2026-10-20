// Privacy for saved pages. The service worker keeps a copy of the member pages a person opens, so that
// they open on a weak connection. Those copies belong to one account: delete them on sign-out and when a
// different account signs in on the same device.

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

/** Call when the signed-in user is known. Clears saved pages if it is a different account from last time. */
export function noteSignedInUser(userId: string | null | undefined): void {
  try {
    if (!userId) return;
    const prev = localStorage.getItem(LAST_USER_KEY);
    if (prev && prev !== userId) void clearUserCache();
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch { /* storage blocked */ }
}
