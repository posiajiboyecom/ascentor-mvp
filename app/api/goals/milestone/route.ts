// app/api/goals/milestone/route.ts
// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/goals/milestone
// Toggles a single milestone's completed state on the current user's goal.
//
// Request body:
//   { goalId: string, field: 'milestone_1' | 'milestone_2' | 'milestone_3', completed: boolean }
//
// Response:
//   200 { ok: true }
//   400 { error: string }   — missing/invalid fields
//   401 { error: string }   — not authenticated
//   403 { error: string }   — goal belongs to a different user
//   500 { error: string }   — database error
//
// ── Database prerequisite ─────────────────────────────────────────────────
// This route writes to milestone_1_completed, milestone_2_completed, and
// milestone_3_completed columns on the user_goals table. These columns do
// not exist in the original schema — add them with this migration before
// deploying:
//
//   ALTER TABLE user_goals
//     ADD COLUMN IF NOT EXISTS milestone_1_completed boolean NOT NULL DEFAULT false,
//     ADD COLUMN IF NOT EXISTS milestone_2_completed boolean NOT NULL DEFAULT false,
//     ADD COLUMN IF NOT EXISTS milestone_3_completed boolean NOT NULL DEFAULT false;
//
// Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Only these three field names are accepted — anything else is rejected.
const VALID_FIELDS = new Set([
  'milestone_1',
  'milestone_2',
  'milestone_3',
] as const);

type MilestoneField = 'milestone_1' | 'milestone_2' | 'milestone_3';

// Maps milestone text field → its corresponding completion column
function completionColumn(field: MilestoneField): string {
  return `${field}_completed`;
}

export async function PATCH(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { goalId, field, completed } = body as {
    goalId:    unknown;
    field:     unknown;
    completed: unknown;
  };

  if (typeof goalId !== 'string' || !goalId.trim()) {
    return NextResponse.json({ error: 'goalId is required' }, { status: 400 });
  }

  if (typeof field !== 'string' || !VALID_FIELDS.has(field as MilestoneField)) {
    return NextResponse.json(
      { error: 'field must be one of: milestone_1, milestone_2, milestone_3' },
      { status: 400 }
    );
  }

  if (typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'completed must be a boolean' }, { status: 400 });
  }

  // ── Ownership check ───────────────────────────────────────────────────
  // Fetch just enough to verify the goal belongs to this user.
  // Never trust goalId alone — without this check any authenticated user
  // could toggle another user's milestones by guessing a UUID.
  const { data: existing, error: fetchError } = await supabase
    .from('user_goals')
    .select('id, user_id')
    .eq('id', goalId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Update ────────────────────────────────────────────────────────────
  const column = completionColumn(field as MilestoneField);

  const { error: updateError } = await supabase
    .from('user_goals')
    .update({
      [column]:   completed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', user.id); // double-scoped for defence in depth

  if (updateError) {
    console.error('[milestone route] update error:', updateError);
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
