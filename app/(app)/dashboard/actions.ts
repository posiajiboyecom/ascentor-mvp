'use server';

// app/(app)/dashboard/actions.ts
// Server action wrapper around the commitment toggle so the
// client-side checklist can call it without exposing the
// server Supabase client to the browser bundle.

import { revalidatePath } from 'next/cache';
import { toggleCommitment } from '@/lib/supabase/queries/dashboard';

export async function toggleCommitmentAction(
  commitmentId: string,
  completed: boolean
) {
  await toggleCommitment(commitmentId, completed);
  revalidatePath('/dashboard');
}
