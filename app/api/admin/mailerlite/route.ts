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
      mlFetch('/campaigns?limit=10'),
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

// ============================================================
// POST /api/admin/mailerlite
// Action: "sync" — pulls all Supabase subscribers + app users
// and upserts them into MailerLite in batches of 50.
// Action: "sync-user" — syncs a single email immediately.
// ============================================================
export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'sync';

  // ── Single-user sync ─────────────────────────────────────
  if (action === 'sync-user') {
    const { email, firstName, groups } = body;
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    try {
      await mlUpsert(email, firstName || '', groups || []);
      return NextResponse.json({ ok: true, synced: 1 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── Full sync ─────────────────────────────────────────────
  // Use service role for reading all users
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. All newsletter_subscribers (active only)
    const { data: nlSubs } = await service
      .from('newsletter_subscribers')
      .select('email, first_name, source')
      .eq('is_active', true);

    // 2. All app users (profiles with email)
    const { data: appUsers } = await service
      .from('profiles')
      .select('email: email, full_name, subscription_plan, subscription_status');

    // Merge and deduplicate by email
    const map = new Map<string, { email: string; name: string; groups: string[]; source: string }>();

    const GROUP_NEWSLETTER = process.env.MAILERLITE_GROUP_NEWSLETTER || '';
    const GROUP_APP_USERS  = process.env.MAILERLITE_GROUP_APP_USERS  || '';
    const GROUP_PAID       = process.env.MAILERLITE_GROUP_PAID_USERS || '';
    const GROUP_FREE       = process.env.MAILERLITE_GROUP_FREE_USERS || '';

    for (const s of (nlSubs || [])) {
      if (!s.email) continue;
      const key = s.email.trim().toLowerCase();
      map.set(key, {
        email: key,
        name: s.first_name || '',
        groups: [GROUP_NEWSLETTER].filter(Boolean),
        source: s.source || 'newsletter',
      });
    }

    for (const u of (appUsers || [])) {
      if (!u.email) continue;
      const key = u.email.trim().toLowerCase();
      const existing = map.get(key) || { email: key, name: '', groups: [] as string[], source: 'app' };

      // Add app user group
      if (GROUP_APP_USERS && !existing.groups.includes(GROUP_APP_USERS)) {
        existing.groups.push(GROUP_APP_USERS);
      }

      // Add paid/free group based on subscription
      const isPaid = u.subscription_status === 'active' && u.subscription_plan && u.subscription_plan !== 'free';
      if (isPaid && GROUP_PAID && !existing.groups.includes(GROUP_PAID)) {
        existing.groups.push(GROUP_PAID);
      } else if (!isPaid && GROUP_FREE && !existing.groups.includes(GROUP_FREE)) {
        existing.groups.push(GROUP_FREE);
      }

      // Use full_name if no name yet
      if (!existing.name && u.full_name) {
        existing.name = u.full_name.split(' ')[0] || '';
      }

      map.set(key, existing);
    }

    const records = Array.from(map.values());
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // Upsert in batches of 50 — MailerLite rate limit is 60 req/min
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (r) => {
          try {
            await mlUpsert(r.email, r.name, r.groups);
            synced++;
          } catch (err: any) {
            failed++;
            errors.push(`${r.email}: ${err.message}`);
          }
        })
      );
      // Small delay between batches to respect rate limits
      if (i + BATCH < records.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      ok: true,
      total: records.length,
      synced,
      failed,
      errors: errors.slice(0, 10), // cap error list
    });

  } catch (err: any) {
    console.error('[mailerlite sync]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── MailerLite upsert helper ─────────────────────────────────
async function mlUpsert(email: string, name: string, groups: string[]) {
  const validGroups = groups.filter(Boolean);
  const body: Record<string, any> = {
    email: email.trim().toLowerCase(),
    fields: { name: name || '' },
    status: 'active',
    resubscribe: true,
  };
  if (validGroups.length > 0) body.groups = validGroups;

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204 || res.status === 200 || res.status === 201) return;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `MailerLite ${res.status}`);
  }
}
