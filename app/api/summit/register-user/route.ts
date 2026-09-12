import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendRegistrationReceivedEmail } from '@/lib/summitEmails';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, current_role')
    .eq('id', user.id)
    .single();

  const fullName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'Ascentor User';
  const email = profile?.email || user.email || '';

  const { data: existing } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, payment_status')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existing?.payment_status === 'paid') {
    return NextResponse.json({ ok: true, alreadyRegistered: true });
  }

  if (existing) {
    return NextResponse.json({ ok: true, registrationId: existing.id, alreadyRegistered: true });
  }

  const { data: created, error } = await supabaseAdmin
    .from('summit_registrations')
    .insert({
      user_id: user.id,
      full_name: fullName,
      email: email.trim().toLowerCase(),
      whatsapp: '',
      location: '',
      organisation: '',
      current_role: profile?.current_role || '',
      other_messages: null,
      consent: true,
      source: 'app',
      status: 'pending',
      payment_status: 'pending',
    })
    .select('id')
    .single();

  if (error || !created) {
    if (error?.code === '23505') {
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }
    console.error('[summit/register-user] DB error:', error?.message);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: user.id,
    type: 'expert',
    title: "You're registered for The Elevation Summit!",
    message: '19 November 2026 · Lagos, Nigeria. We\'ll be in touch closer to the event.',
    link: '/elevation-summit',
    read: false,
  });

  try {
    if (email) await sendRegistrationReceivedEmail(email, fullName);
  } catch (err: any) {
    console.warn('[summit/register-user] email non-fatal:', err.message);
  }

  return NextResponse.json({ ok: true, registrationId: created.id });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabaseAdmin
    .from('summit_registrations')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('[summit/register-user] delete error:', error.message);
    return NextResponse.json({ error: 'Unregister failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
