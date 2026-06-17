// app/api/community/voice-upload/route.ts
// Handles voice message uploads server-side using service role key.
// This bypasses RLS entirely — auth is verified via the user's JWT.
// The client sends: FormData with fields: file (Blob), channel, userId

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify the user is authenticated via their session cookie
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse the multipart form
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const channel  = formData.get('channel') as string | null;
    const duration = formData.get('duration') as string | null;

    if (!file || !channel) {
      return NextResponse.json({ error: 'Missing file or channel' }, { status: 400 });
    }

    // 3. Validate file — must be audio, max 10MB
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'File must be audio' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // 4. Upload using service role client (bypasses RLS)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ext  = file.type.includes('ogg') ? 'ogg' : file.type.includes('mp4') ? 'm4a' : 'webm';
    const path = `voice/${user.id}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error: uploadError } = await serviceClient.storage
      .from('community-voice')
      .upload(path, buffer, {
        contentType: file.type,
        upsert:      false,
      });

    if (uploadError) {
      console.error('[voice-upload] Storage error:', uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 5. Get public URL
    const { data: { publicUrl } } = serviceClient.storage
      .from('community-voice')
      .getPublicUrl(path);

    // 6. Insert the message using the user's client (respects RLS on messages table)
    const dur    = parseInt(duration || '0', 10) || 1;
    const content = `[voice:${publicUrl}:${dur}]`;

    const { error: dbError } = await authClient.from('community_messages').insert({
      user_id: user.id,
      channel,
      content,
      likes: [],
    });

    if (dbError) {
      console.error('[voice-upload] DB insert error:', dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, publicUrl, content });
  } catch (err: any) {
    console.error('[voice-upload] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
