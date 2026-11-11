// app/api/partner/events/route.ts
//
// GET    - list partner's events (upcoming + past, paginated)
// POST   - create a new event (Growth/Pro only, monthly limit enforced)
// PATCH  - update / publish / cancel an event
// DELETE - delete a draft event (cannot delete published with attendees)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as partnerSchemas from '@/lib/validation/schemas/partner';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Auth helper ───────────────────────────────────────────
async function getPartner(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };

  const { data: partner } = await supabase
    .from('partners')
    .select('id, owner_id, status')
    .eq('owner_id', user.id)
    .single();

  if (!partner) return { error: 'No partner account', status: 404 };
  if (partner.status === 'suspended') return { error: 'Account suspended', status: 403 };

  return { partner, userId: user.id };
}

// ── GET: list events ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'upcoming'; // 'upcoming' | 'past' | 'all'
    const now  = new Date().toISOString();

    let query = supabase
      .from('partner_events')
      .select('*')
      .eq('partner_id', partner.id);

    if (view === 'upcoming') query = query.gte('scheduled_at', now).order('scheduled_at', { ascending: true });
    else if (view === 'past') query = query.lt('scheduled_at', now).order('scheduled_at', { ascending: false });
    else query = query.order('scheduled_at', { ascending: false });

    const { data: events, error } = await query;
    if (error) throw error;

    // Partners have no plan or limits: every partner can schedule events.
    return NextResponse.json({ events: events || [] });
  } catch (err) {
    console.error('[Partner Events GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: create event ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const parsed = await parseJson(req, partnerSchemas.eventCreate);
    if (!parsed.ok) return parsed.response;
    const {
      title, description, expert_name, expert_bio, expert_avatar,
      scheduled_at, duration_minutes, max_attendees,
      meeting_url, topic,
    } = parsed.data;

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled date' }, { status: 400 });
    }
    if (scheduledDate < new Date()) {
      return NextResponse.json({ error: 'Scheduled date must be in the future' }, { status: 400 });
    }

    const { data: event, error } = await supabase
      .from('partner_events')
      .insert({
        partner_id:       partner.id,
        title:            title.trim(),
        description:      description?.trim() || null,
        expert_name:      expert_name.trim(),
        expert_bio:       expert_bio?.trim() || null,
        expert_avatar:    expert_avatar || null,
        scheduled_at:     scheduledDate.toISOString(),
        duration_minutes: duration_minutes ? Number(duration_minutes) : 60,
        max_attendees:    max_attendees ? Number(max_attendees) : null,
        meeting_url:      meeting_url?.trim() || null,
        topic:            topic?.trim() || null,
        status:           'draft',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ event }, { status: 201 });
  } catch (err: any) {
    console.error('[Partner Events POST]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ── PATCH: update / publish / cancel ─────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const parsedUpdate = await parseJson(req, partnerSchemas.eventUpdate);
    if (!parsedUpdate.ok) return parsedUpdate.response;
    const { eventId, ...updatesTyped } = parsedUpdate.data;
    const updates = updatesTyped as Record<string, unknown>;

    // Confirm event belongs to this partner
    const { data: existing } = await supabase
      .from('partner_events')
      .select('id, status, current_attendees')
      .eq('id', eventId)
      .eq('partner_id', partner.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Cannot un-cancel a cancelled event
    if (existing.status === 'cancelled' && updates.status && updates.status !== 'cancelled') {
      return NextResponse.json({ error: 'Cancelled events cannot be reinstated' }, { status: 400 });
    }

    const allowed = [
      'title', 'description', 'expert_name', 'expert_bio', 'expert_avatar',
      'scheduled_at', 'duration_minutes', 'max_attendees', 'meeting_url',
      'recording_url', 'topic', 'status',
    ];
    const safe: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) safe[key] = updates[key];
    }

    // Validate scheduled_at if being updated
    if (safe.scheduled_at) {
      const d = new Date(safe.scheduled_at as string);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduled date' }, { status: 400 });
      }
    }

    const { data: updated, error } = await supabase
      .from('partner_events')
      .update(safe)
      .eq('id', eventId)
      .eq('partner_id', partner.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ event: updated });
  } catch (err: any) {
    console.error('[Partner Events PATCH]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ── DELETE: remove draft event ────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const parsedQuery = parseQuery(req, partnerSchemas.eventDeleteQuery);
    if (!parsedQuery.ok) return parsedQuery.response;
    const { eventId } = parsedQuery.data;

    const { data: existing } = await supabase
      .from('partner_events')
      .select('id, status, current_attendees')
      .eq('id', eventId)
      .eq('partner_id', partner.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Block deletion of published events that have registrations
    if (existing.status === 'published' && existing.current_attendees > 0) {
      return NextResponse.json({
        error: 'Cannot delete a published event with registered attendees. Cancel it instead.',
      }, { status: 400 });
    }

    await supabase.from('partner_events').delete().eq('id', eventId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Partner Events DELETE]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
