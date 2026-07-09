// app/api/admin/knowledge/upload-pdfs/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/knowledge/upload-pdfs
//
// Accepts multiple PDFs via multipart/form-data and uploads them
// to the 'knowledge-pdfs' Supabase Storage bucket.
// Returns a list of storage paths for the batch ingestion task.
//
// Form fields (all repeatable):
//   files[]        — one or more PDF files
//   mentorSlugs[]  — one slug per file (same order as files)
//   namespaces[]   — one namespace per file
//   sourceTitles[] — one source title per file
//   tags[]         — one comma-separated tag string per file
//
// The bucket is private. The Trigger.dev task reads files using
// the service role key, so no public URLs are needed.
// ─────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const BUCKET       = 'knowledge-pdfs';
const MAX_FILE_MB  = 20;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES    = 30;

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function ensureBucket(supabase: ReturnType<typeof getServiceClient>) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);

  const exists = (buckets || []).some(b => b.name === BUCKET);
  if (exists) return;

  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ['application/pdf'],
    fileSizeLimit: MAX_FILE_BYTES,
  });

  if (createErr && !createErr.message?.includes('already exists')) {
    throw new Error(`createBucket failed: ${createErr.message}`);
  }
}

export async function POST(req: Request) {
  // ── Auth + admin gate ──────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse multipart form ───────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const files        = formData.getAll('files[]') as File[];
  const mentorSlugs  = formData.getAll('mentorSlugs[]') as string[];
  const namespaces   = formData.getAll('namespaces[]') as string[];
  const sourceTitles = formData.getAll('sourceTitles[]') as string[];
  const tagsRaw      = formData.getAll('tags[]') as string[];

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files per batch` },
      { status: 400 }
    );
  }

  // Validate all files and metadata before uploading anything
  const errors: string[] = [];
  files.forEach((file, i) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      errors.push(`File ${i + 1} ("${file.name}"): only PDF files accepted`);
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`File ${i + 1} ("${file.name}"): exceeds ${MAX_FILE_MB}MB limit`);
    }
    if (!mentorSlugs[i]?.trim()) {
      errors.push(`File ${i + 1} ("${file.name}"): mentor is required`);
    }
    if (!namespaces[i]?.trim()) {
      errors.push(`File ${i + 1} ("${file.name}"): namespace is required`);
    }
    if (!sourceTitles[i]?.trim()) {
      errors.push(`File ${i + 1} ("${file.name}"): source title is required`);
    }
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(' · ') }, { status: 400 });
  }

  // ── Ensure bucket exists ───────────────────────────────────
  const serviceClient = getServiceClient();
  try {
    await ensureBucket(serviceClient);
  } catch (err: any) {
    console.error('[upload-pdfs] ensureBucket failed:', err.message);
    return NextResponse.json({ error: 'Storage setup failed' }, { status: 500 });
  }

  // ── Upload files to storage ────────────────────────────────
  const uploaded: {
    storagePath: string;
    fileName: string;
    mentorSlug: string;
    namespace: string;
    sourceTitle: string;
    tags: string[];
  }[] = [];

  const uploadErrors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const slug = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const safeFileName = file.name.replace(/[^A-Za-z0-9._-]/g, '-');
    const storagePath  = `pending/${slug}-${safeFileName}`;

    try {
      const buffer = await file.arrayBuffer();
      const { error: uploadErr } = await serviceClient.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType:  'application/pdf',
          upsert:       false,
          cacheControl: '3600',
        });

      if (uploadErr) {
        uploadErrors.push(`"${file.name}": ${uploadErr.message}`);
        continue;
      }

      uploaded.push({
        storagePath,
        fileName:    file.name,
        mentorSlug:  mentorSlugs[i].trim(),
        namespace:   namespaces[i].trim(),
        sourceTitle: sourceTitles[i].trim(),
        tags:        tagsRaw[i]
          ? tagsRaw[i].split(',').map(t => t.trim()).filter(Boolean)
          : [],
      });
    } catch (err: any) {
      uploadErrors.push(`"${file.name}": ${err.message}`);
    }
  }

  if (uploaded.length === 0) {
    return NextResponse.json(
      { error: `All uploads failed: ${uploadErrors.join(' · ')}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success:      true,
    uploaded:     uploaded.length,
    failed:       uploadErrors.length,
    uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
    files:        uploaded,
  });
}
