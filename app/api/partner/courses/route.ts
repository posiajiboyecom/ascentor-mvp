// ============================================================
// app/api/partner/courses/route.ts
// GET:    List partner's own courses
// POST:   Create a new partner course
// PATCH:  Update / publish / unpublish a course
// DELETE: Delete a course (only if no enrollments)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Auth + partner ownership helper ──────────────────────
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

// ── GET: list courses ─────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const { data: courses, error } = await supabase
      .from('partner_courses')
      .select('*')
      .eq('partner_id', partner.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Fetch enrollment counts per course
    const courseIds = (courses || []).map(c => c.id);
    let enrollmentMap: Record<string, number> = {};

    if (courseIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('partner_course_enrollments')
        .select('course_id')
        .in('course_id', courseIds);

      (enrollments || []).forEach(e => {
        enrollmentMap[e.course_id] = (enrollmentMap[e.course_id] || 0) + 1;
      });
    }

    const coursesWithCounts = (courses || []).map(c => ({
      ...c,
      enrollment_count: enrollmentMap[c.id] || 0,
    }));

    return NextResponse.json({ courses: coursesWithCounts });
  } catch (err) {
    console.error('[Partner Courses GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: create course ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const body = await req.json();
    const { title, description, youtube_id, category, difficulty, duration, thumbnail_url } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!youtube_id?.trim()) return NextResponse.json({ error: 'YouTube video ID or URL is required' }, { status: 400 });

    // Extract YouTube ID from URL if full URL provided
    const ytId = extractYoutubeId(youtube_id.trim());
    if (!ytId) return NextResponse.json({ error: 'Invalid YouTube URL or ID' }, { status: 400 });

    // Get current max sort_order
    const { data: last } = await supabase
      .from('partner_courses')
      .select('sort_order')
      .eq('partner_id', partner.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sort_order = (last?.sort_order ?? 0) + 1;

    const { data: course, error } = await supabase
      .from('partner_courses')
      .insert({
        partner_id:    partner.id,
        title:         title.trim(),
        description:   description?.trim() || null,
        youtube_id:    ytId,
        category:      category?.trim() || null,
        difficulty:    difficulty || null,
        duration:      duration?.trim() || null,
        thumbnail_url: thumbnail_url || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
        is_published:  false,
        sort_order,
        created_at:    new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ course }, { status: 201 });
  } catch (err: any) {
    console.error('[Partner Courses POST]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ── PATCH: update / publish / reorder ────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const body = await req.json();
    const { courseId, ...updates } = body;

    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

    // Confirm course belongs to this partner
    const { data: existing } = await supabase
      .from('partner_courses')
      .select('id')
      .eq('id', courseId)
      .eq('partner_id', partner.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    // Sanitise updates — only allow known fields
    const allowed = ['title', 'description', 'youtube_id', 'category', 'difficulty',
                     'duration', 'thumbnail_url', 'is_published', 'sort_order', 'access_tier'];
    const safe: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in updates) safe[key] = updates[key];
    }

    if (safe.youtube_id) {
      safe.youtube_id = extractYoutubeId(safe.youtube_id);
      if (!safe.youtube_id) return NextResponse.json({ error: 'Invalid YouTube ID' }, { status: 400 });
    }

    const { data: course, error } = await supabase
      .from('partner_courses')
      .update(safe)
      .eq('id', courseId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ course });
  } catch (err: any) {
    console.error('[Partner Courses PATCH]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ── DELETE: remove course ────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const result = await getPartner(req);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { partner } = result;

    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

    // Confirm ownership
    const { data: existing } = await supabase
      .from('partner_courses')
      .select('id, title')
      .eq('id', courseId)
      .eq('partner_id', partner.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    // Check for enrollments
    const { count } = await supabase
      .from('partner_course_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId);

    if ((count ?? 0) > 0) {
      return NextResponse.json({
        error: `Cannot delete — ${count} member${count !== 1 ? 's' : ''} enrolled. Unpublish instead.`
      }, { status: 409 });
    }

    await supabase.from('partner_courses').delete().eq('id', courseId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Partner Courses DELETE]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── Utility ───────────────────────────────────────────────
function extractYoutubeId(input: string): string {
  if (!input) return '';
  // If it's already a plain ID (11 chars, no slashes)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  // Extract from URL
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return '';
}
