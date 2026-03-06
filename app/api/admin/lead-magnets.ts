import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// GET /api/admin/lead-magnets
// Returns download counts and conversion data per magnet.
// Protected: admin only
// ============================================================

const MAGNET_DEFS = [
  { id: 'leadership-blueprint', name: 'The African Leadership Blueprint',   type: 'PDF',           url: '/free/leadership-blueprint' },
  { id: '30-day-challenge',     name: 'Free 30-Day Leadership Challenge',    type: 'Email Series',  url: '/free/30-day-challenge' },
  { id: 'salary-toolkit',       name: 'African Professional Salary Toolkit', type: 'Template Pack', url: '/free/salary-toolkit' },
];

export async function GET() {
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAuth
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use service role for reading lead_magnet_downloads
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get all downloads
    const { data: downloads } = await supabase
      .from('lead_magnet_downloads')
      .select('magnet_id, email, created_at')
      .order('created_at', { ascending: false });

    const rows = downloads || [];

    // Aggregate per magnet
    const magnets = MAGNET_DEFS.map(def => {
      const magnetRows = rows.filter(r => r.magnet_id === def.id);
      const uniqueEmails = new Set(magnetRows.map(r => r.email)).size;

      // Rough paid conversion: count emails that also exist in profiles as paid
      // (we'll do a simple count for now — enhance later with join)
      return {
        id:          def.id,
        name:        def.name,
        type:        def.type,
        url:         def.url,
        downloads:   uniqueEmails,
        total_opts:  magnetRows.length,
        last_opt_in: magnetRows[0]?.created_at || null,
        status:      'live',
      };
    });

    // Recent opt-ins (last 20)
    const recent = rows.slice(0, 20).map(r => ({
      magnet_id:  r.magnet_id,
      email:      r.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // mask email
      created_at: r.created_at,
    }));

    return NextResponse.json({ magnets, recent, total: rows.length });

  } catch (err: any) {
    console.error('[LeadMagnets Admin] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
