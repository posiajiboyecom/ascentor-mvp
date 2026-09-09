import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPasswordResetOTP } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up user in auth.users to check provider
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error('[forgot-password] list users error:', authError);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }

    const authUser = authUsers.users.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (!authUser) {
      // Email not found - return specific response
      return NextResponse.json({
        success: false,
        status: 'not_found',
        message: 'No account found with that email address.',
      });
    }

    // Check if user signed up with OAuth provider
    const provider = authUser.app_metadata?.provider;
    if (provider === 'google' || provider === 'linkedin') {
      return NextResponse.json({
        success: false,
        status: 'oauth_only',
        provider: provider === 'google' ? 'Google' : 'LinkedIn',
        message: `You signed up with ${provider === 'google' ? 'Google' : 'LinkedIn'}. Please use your social account to sign in. Password reset is not available for social accounts.`,
      });
    }

    // Get profile for name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store OTP
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_otps')
      .insert({
        email: normalizedEmail,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      console.error('[forgot-password] insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate reset code' }, { status: 500 });
    }

    // Send email
    try {
      await sendPasswordResetOTP({
        to: normalizedEmail,
        otpCode,
        firstName: profile?.full_name || 'there',
      });
    } catch (emailError) {
      console.error('[forgot-password] email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      status: 'sent',
      message: 'If an account exists, a reset code has been sent.',
    });
  } catch (err) {
    console.error('[forgot-password] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
