// app/api/admin/surveys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';
import { guardApi } from '@/lib/admin/api-guard';

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'moderator'].includes(profile.role)) return null;
  return user;
}

// GET /api/admin/surveys - list all surveys
export async function GET() {
  const _g = await guardApi('surveys', 'view');
  if ('error' in _g) return _g.res;
  const supabase = await createClient();
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('surveys')
    .select('id, title, slug, is_published, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/surveys - create survey
export async function POST(req: NextRequest) {
  const _g = await guardApi('surveys', 'edit', req);
  if ('error' in _g) return _g.res;
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJson(req, adminSchemas.surveyCreate);
  if (!parsed.ok) return parsed.response;
  const { title, description, slug, questions } = parsed.data;

  const { data, error } = await supabase
    .from('surveys')
    .insert({ title, description: description ?? null, slug, questions, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
