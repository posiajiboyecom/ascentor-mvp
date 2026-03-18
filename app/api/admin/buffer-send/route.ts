// app/api/admin/buffer-send/route.ts
// POST { queueId: string }
// Sends a specific social_queue row to Buffer immediately.
// Called from the Social Queue tab Send button.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import {
  getBufferProfiles,
  getProfileIdsForPlatform,
  scheduleBufferPost,
} from '@/lib/buffer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Auth + admin check
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { queueId, imageUrl: bodyImageUrl } = await req.json();
    if (!queueId) return NextResponse.json({ error: 'queueId required' }, { status: 400 });

    // Fetch the queue row
    const { data: post, error: fetchErr } = await supabase
      .from('social_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.buffer_update_id) return NextResponse.json({ error: 'Already sent to Buffer' }, { status: 400 });

    // Get Buffer profiles
    const profiles = await getBufferProfiles();
    const profileIds = await getProfileIdsForPlatform(post.platform, profiles);

    if (profileIds.length === 0) {
      return NextResponse.json({ error: `No Buffer profile connected for platform: ${post.platform}` }, { status: 400 });
    }

    // Use image from request body (freshly uploaded) or fall back to what's in DB
    const imageUrl = bodyImageUrl || post.image_url || null;
    let text = post.content || '';

    const results = await scheduleBufferPost({
      profile_ids: profileIds,
      text,
      scheduled_at: post.scheduled_for || undefined,
      shorten: true,
    });

    const success = results.filter(r => r.success);
    const failed  = results.filter(r => !r.success);

    if (success.length > 0) {
      // Update queue row with Buffer ID and status
      await supabase
        .from('social_queue')
        .update({
          buffer_update_id: success[0].update_id,
          status: 'scheduled_buffer',
        })
        .eq('id', queueId);
    }

    return NextResponse.json({
      success: success.length > 0,
      sent: success.length,
      failed: failed.length,
      updateId: success[0]?.update_id,
      errors: failed.map(f => f.error),
    });
  } catch (err: any) {
    console.error('[buffer-send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
