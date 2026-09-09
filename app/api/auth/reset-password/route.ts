import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { email, otp_code, new_password } = await req.json();

    if (!email || !otp_code || !new_password) {
      return NextResponse.json({ error: 'Email, OTP code, and new password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtp = otp_code.trim();

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('password_reset_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('otp_code', normalizedOtp)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired reset code' }, { status: 400 });
    }

    // Get user by email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) {
      console.error('[reset-password] list users error:', userError);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      console.error('[reset-password] update error:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Mark OTP as used
    await supabaseAdmin
      .from('password_reset_otps')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // Invalidate all existing sessions for security
    try {
      await supabaseAdmin.auth.admin.signOut(user.id, 'global');
    } catch (signOutError) {
      console.error('[reset-password] signOut error:', signOutError);
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[reset-password] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
