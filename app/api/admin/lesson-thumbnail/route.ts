// app/api/admin/lesson-thumbnail/route.ts
// POST multipart/form-data { file, rowId? }
// Uploads a lesson picture (PNG, JPG or WebP, max 2 MB) to the public 'content-media' bucket under lesson-thumbnails/
// and returns { url }. With rowId ("l:<rx_lessons.id>") it also saves the URL on that lesson straight away, which is what
// the Pathways drawer does. Without it the caller saves the URL itself — the admin Lessons form does that, so a picture can
// be chosen for a lesson that has not been created yet.
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/admin/api-guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { auditAdmin } from '@/lib/admin/audit';

const BUCKET = 'content-media';
const MAX_BYTES = 2 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function POST(req: NextRequest) {
  const g = await guardApi('pathways', 'edit', req);
  if ('error' in g) return g.res;
  try {
    const form = await req.formData();
    const file = form.get('file');
    const rowId = String(form.get('rowId') ?? '');
    const id = rowId.startsWith('l:') ? rowId.slice(2) : '';
    if (rowId && !/^[0-9a-f-]{8,64}$/i.test(id)) return NextResponse.json({ error: 'Pictures can only be added to lessons.' }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image first.' }, { status: 400 });
    const ext = EXT[file.type];
    if (!ext) return NextResponse.json({ error: 'Use a PNG, JPG or WebP image.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That image is over 2 MB. Export it smaller (1280 × 720 is plenty).' }, { status: 400 });

    let lesson: { id: string; title: string } | null = null;
    if (id) {
      const { data } = await supabaseAdmin.from('rx_lessons').select('id, title').eq('id', id).maybeSingle();
      if (!data) return NextResponse.json({ error: 'That lesson no longer exists.' }, { status: 404 });
      lesson = data as { id: string; title: string };
    }

    const path = `lesson-thumbnails/${id || 'new'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 8 * 1024 * 1024 });
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: 'We could not upload that image. Try again.' }, { status: 500 });

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    if (id) {
      const { error: dbErr } = await supabaseAdmin.from('rx_lessons').update({ thumbnail_url: publicUrl }).eq('id', id);
      if (dbErr) return NextResponse.json({ error: 'Uploaded, but we could not save it to the lesson. Try again.' }, { status: 500 });
    }

    const { data: me } = await supabaseAdmin.from('profiles').select('full_name').eq('id', g.staff.userId).maybeSingle();
    await auditAdmin({ userId: g.staff.userId, name: (me?.full_name as string) || 'Staff', roleName: g.staff.roleId }, 'Uploaded lesson picture', lesson?.title ?? 'New lesson', 'Pathways and lessons');
    return NextResponse.json({ url: publicUrl });
  } catch {
    return NextResponse.json({ error: 'We could not upload that image. Try again.' }, { status: 500 });
  }
}
