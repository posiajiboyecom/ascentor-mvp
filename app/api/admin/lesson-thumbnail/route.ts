// app/api/admin/lesson-thumbnail/route.ts
// POST multipart/form-data { file, rowId }  (rowId is the pathways screen row id, "l:<rx_lessons.id>")
// Uploads a lesson thumbnail (PNG, JPG or WebP, max 2 MB) to the public 'content-media' bucket under lesson-thumbnails/,
// saves the public URL to rx_lessons.thumbnail_url and returns { url }.
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
    if (!/^[0-9a-f-]{8,64}$/i.test(id)) return NextResponse.json({ error: 'Thumbnails can only be added to lessons.' }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image first.' }, { status: 400 });
    const ext = EXT[file.type];
    if (!ext) return NextResponse.json({ error: 'Use a PNG, JPG or WebP image.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That image is over 2 MB. Export it smaller (1280 × 720 is plenty).' }, { status: 400 });

    const { data: lesson } = await supabaseAdmin.from('rx_lessons').select('id, title').eq('id', id).maybeSingle();
    if (!lesson) return NextResponse.json({ error: 'That lesson no longer exists.' }, { status: 404 });

    const path = `lesson-thumbnails/${id}-${Date.now()}.${ext}`;
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 8 * 1024 * 1024 });
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: 'We could not upload that image. Try again.' }, { status: 500 });

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const { error: dbErr } = await supabaseAdmin.from('rx_lessons').update({ thumbnail_url: publicUrl }).eq('id', id);
    if (dbErr) return NextResponse.json({ error: 'Uploaded, but we could not save it to the lesson. Try again.' }, { status: 500 });

    const { data: me } = await supabaseAdmin.from('profiles').select('full_name').eq('id', g.staff.userId).maybeSingle();
    await auditAdmin({ userId: g.staff.userId, name: (me?.full_name as string) || 'Staff', roleName: g.staff.roleId }, 'Uploaded lesson thumbnail', (lesson.title as string) ?? id, 'Pathways and lessons');
    return NextResponse.json({ url: publicUrl });
  } catch {
    return NextResponse.json({ error: 'We could not upload that image. Try again.' }, { status: 500 });
  }
}
