'use server';

// app/(app)/dashboard/actions.ts
// Server actions for the dashboard's interactive cards. Each one
// re-checks the session and scopes writes to the current user.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toggleCommitment } from '@/lib/supabase/queries/dashboard';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return { supabase, user };
}

export async function toggleCommitmentAction(
  commitmentId: string,
  completed: boolean
) {
  await toggleCommitment(commitmentId, completed);
  revalidatePath('/dashboard');
}

/** Adds a commitment for this week (due Sunday-ish: 7 days out). */
export async function addCommitmentAction(text: string) {
  const clean = text.trim().slice(0, 200);
  if (!clean) throw new Error('Write your commitment first.');
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from('user_commitments')
    .insert({
      user_id: user.id,
      commitment_text: clean,
      completed: false,
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    })
    .select('*')
    .single();
  if (error) throw error;

  revalidatePath('/dashboard');
  return data;
}

export async function deleteCommitmentAction(commitmentId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('user_commitments')
    .delete()
    .eq('id', commitmentId)
    .eq('user_id', user.id);
  if (error) throw error;
  revalidatePath('/dashboard');
}

export interface GoalInput {
  goalId?: string | null;
  goalText: string;
  milestones: string[];
}

/** Creates the member's 90-day goal, or edits the current one. */
export async function saveGoalAction({ goalId, goalText, milestones }: GoalInput) {
  const text = goalText.trim().slice(0, 300);
  if (!text) throw new Error('Describe your 90-day goal.');
  const [m1, m2, m3] = [0, 1, 2].map((i) => milestones[i]?.trim().slice(0, 160) || null);
  const { supabase, user } = await requireUser();

  if (goalId) {
    const { error } = await supabase
      .from('user_goals')
      .update({
        goal_text: text,
        milestone_1: m1,
        milestone_2: m2,
        milestone_3: m3,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_goals').insert({
      user_id: user.id,
      goal_text: text,
      milestone_1: m1,
      milestone_2: m2,
      milestone_3: m3,
      progress: 0,
    });
    if (error) throw error;
  }
  revalidatePath('/dashboard');
}

export async function toggleMilestoneAction(
  goalId: string,
  field: 'milestone_1' | 'milestone_2' | 'milestone_3',
  completed: boolean
) {
  if (!['milestone_1', 'milestone_2', 'milestone_3'].includes(field)) {
    throw new Error('Invalid milestone');
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('user_goals')
    .update({
      [`${field}_completed`]: completed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', user.id);
  if (error) throw error;
  revalidatePath('/dashboard');
}
