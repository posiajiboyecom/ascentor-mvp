// app/api/admin/content/assign/route.ts
// Assigns a content_calendar item to a team member + fires in-app notification

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — only admin/moderator can assign
    const authHeader = req.headers.get('authorization');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: me } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (!me || !['admin', 'moderator'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { contentId, assigneeId, contentTitle } = await req.json();
    if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 });

    // 2. Update content_calendar
    const { error: updateError } = await supabase
      .from('content_calendar')
      .update({ assigned_to: assigneeId || null })
      .eq('id', contentId);

    if (updateError) throw updateError;

    // 3. Fire in-app notification if assigning (not unassigning)
    if (assigneeId) {
      const assignerName = me.full_name || me.email || 'Admin';
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id:  assigneeId,
          type:     'assignment',
          title:    'Content assigned to you',
          body:     `${assignerName} assigned "${contentTitle || 'Untitled'}" to you for review.`,
          link:     '/admin/content',
          read:     false,
          metadata: {
            content_id:    contentId,
            content_title: contentTitle,
            assigned_by:   user.id,
            assigned_by_name: assignerName,
          },
        });

      if (notifError) {
        // Don't fail the whole request — assignment succeeded, notification is best-effort
        console.error('Notification insert failed:', notifError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}