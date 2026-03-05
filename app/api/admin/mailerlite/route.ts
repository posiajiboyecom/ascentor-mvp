import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// API — /api/admin/mailerlite
// GET  → fetches subscriber stats, groups, recent campaigns
// Protected: admin/moderator only
// Env: MAILERLITE_API_KEY
// ============================================================

const ML_BASE = 'https://connect.mailerlite.com/api';

async function mlFetch(path: string) {
  const res = await fetch(`${ML_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // cache 5 mins
  });
  if (!res.ok) throw new Error(`MailerLite ${path} → ${res.status}`);
  return res.json();
}

export async function GET() {
  // ── Auth guard ────────────────────────────────────────────
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

  if (!process.env.MAILERLITE_API_KEY) {
    return NextResponse.json({ error: 'MAILERLITE_API_KEY not set' }, { status: 500 });
  }

  try {
    // Fetch in parallel
    const [subsRes, groupsRes, campaignsRes] = await Promise.all([
      mlFetch('/subscribers?limit=1&filter[status]=active'),
      mlFetch('/groups?limit=25'),
      mlFetch('/campaigns?limit=10&filter[status]=sent&sort=-scheduled_for'),
    ]);

    // ── Subscriber stats ──────────────────────────────────
    const totalSubscribers  = subsRes.meta?.total      || 0;
    const activeSubscribers = subsRes.meta?.total      || 0;

    // ── Groups ────────────────────────────────────────────
    const groups = (groupsRes.data || []).map((g: any) => ({
      id:    g.id,
      name:  g.name,
      total: g.total_count || 0,
    }));

    // ── Campaigns — calc avg open/click rates ─────────────
    const campaigns = (campaignsRes.data || []).map((c: any) => ({
      id:           c.id,
      name:         c.name,
      subject:      c.emails?.[0]?.subject || c.name,
      opens_count:  c.stats?.opens_count  || 0,
      clicks_count: c.stats?.clicks_count || 0,
      sent_at:      c.scheduled_for       || null,
      status:       c.status,
      open_rate:    c.stats?.open_rate    || 0,
      click_rate:   c.stats?.click_rate   || 0,
    }));

    const avgOpenRate = campaigns.length
      ? Math.round(campaigns.reduce((s: number, c: any) => s + c.open_rate, 0) / campaigns.length * 10) / 10
      : 0;

    const avgClickRate = campaigns.length
      ? Math.round(campaigns.reduce((s: number, c: any) => s + c.click_rate, 0) / campaigns.length * 10) / 10
      : 0;

    // ── Unsubscribed count ────────────────────────────────
    let unsubscribed = 0;
    try {
      const unsubRes = await mlFetch('/subscribers?limit=1&filter[status]=unsubscribed');
      unsubscribed = unsubRes.meta?.total || 0;
    } catch { /* non-critical */ }

    return NextResponse.json({
      totalSubscribers,
      activeSubscribers,
      avgOpenRate,
      avgClickRate,
      unsubscribed,
      groups,
      recentCampaigns: campaigns,
    });

  } catch (err: any) {
    console.error('MailerLite API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
