'use server';
import { revalidateShell } from '@/lib/shell-data';
import { requireMember } from '@/lib/rx/server';

/** Called from AccountClient after avatar upload so the shell cache refreshes. */
export async function bustShellCache() {
  const { userId } = await requireMember();
  await revalidateShell(userId);
}
