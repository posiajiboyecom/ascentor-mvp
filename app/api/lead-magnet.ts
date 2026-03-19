import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addOrUpdateSubscriber } from '@/lib/mailerlite';

// ═══════════════════════════════════════════════════════════
// POST /api/lead-magnet
// Handles opt-in for all lead magnets.
// 1. Upserts subscriber in MailerLite with correct group
// 2. Records download/opt-in in Supabase for admin tracking
// ═══════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Magnet config ─────────────────────────────────────────
// groupId = MailerLite group ID (set in env or hardcode after creating groups)
const MAGNETS: Record<string, {
  name: string;
  groupEnvKey: string;
  deliveryUrl: string;
  confirmationSubject: string;
}> = {
  // ── Lead Magnet 1: The 90-Day Leadership Playbook ──────────
  'leadership-playbook': {
    name: 'The 90-Day Leadership Playbook',
    groupEnvKey: 'MAILERLITE_GROUP_LEAD_PLAYBOOK',
    deliveryUrl: '/free/leadership-playbook/download',
    confirmationSubject: 'Your 90-Day Leadership Playbook is ready',
  },
  // ── Lead Magnet 2: Why Talented People Don't Get Promoted ──
  'promotion-blueprint': {
    name: "Why Talented People Don't Get Promoted",
    groupEnvKey: 'MAILERLITE_GROUP_LEAD_PROMOTION',
    deliveryUrl: '/free/promotion-blueprint/download',
    confirmationSubject: "Your guide: Why Talented People Don't Get Promoted",
  },
  // ── Lead Magnet 3: Salary Negotiation Script Pack ──────────
  'salary-scripts': {
    name: 'The Salary Negotiation Script Pack',
    groupEnvKey: 'MAILERLITE_GROUP_LEAD_SALARY',
    deliveryUrl: '/free/salary-scripts/download',
    confirmationSubject: 'Your Salary Negotiation Scripts are ready',
  },
  // ── Lead Magnet 4: Career Clarity Audit (Phase 2) ──────────
  'career-audit': {
    name: 'The 10-Minute Career Clarity Audit',
    groupEnvKey: 'MAILERLITE_GROUP_LEAD_AUDIT',
    deliveryUrl: '/free/career-audit/results',
    confirmationSubject: 'Your Career Clarity Audit results',
  },
  // ── Legacy IDs (backwards compatibility) ───────────────────
  'leadership-blueprint': {
    name: 'The 90-Day Leadership Playbook',
    groupEnvKey: 'MAILERLITE_GROUP_LEAD_PLAYBOOK',
    deliveryUrl: '/free/leadership-playbook/download',
    confirmationSubject: 'Your 90-Day Leadership Playbook is ready',
  },
  'salary-toolkit': {
    name: 'The Salary Negotiation Script Pack',
    groupEnvKey: 'MAILERLITE_GROUP_LEAD_SALARY',
    deliveryUrl: '/free/salary-scripts/download',
    confirmationSubject: 'Your Salary Negotiation Scripts are ready',
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { magnetId, email, firstName, source } = body;

    if (!magnetId || !email) {
      return NextResponse.json({ error: 'magnetId and email are required' }, { status: 400 });
    }

    const magnet = MAGNETS[magnetId];
    if (!magnet) {
      return NextResponse.json({ error: 'Unknown magnet' }, { status: 400 });
    }

    const emailClean = email.trim().toLowerCase();
    const groupId = process.env[magnet.groupEnvKey] || '';

    // 1. Add to MailerLite ─────────────────────────────────
    try {
      await addOrUpdateSubscriber({
        email:     emailClean,
        firstName: firstName?.trim() || '',
        groups:    groupId ? [groupId] : [],
        fields: {
          lead_magnet: magnet.name,
          lead_source: source || 'direct',
        },
      });
    } catch (mlErr: any) {
      console.error('[LeadMagnet] MailerLite error:', mlErr.message);
      // Non-fatal — still record in Supabase and return success
    }

    // 2. Track in Supabase ────────────────────────────────
    try {
      await supabase.from('lead_magnet_downloads').insert({
        magnet_id:  magnetId,
        email:      emailClean,
        first_name: firstName?.trim() || null,
        source:     source || 'direct',
        created_at: new Date().toISOString(),
      });
    } catch (dbErr: any) {
      console.error('[LeadMagnet] Supabase error:', dbErr.message);
      // Non-fatal — table may not exist yet
    }

    return NextResponse.json({
      success:     true,
      redirectUrl: magnet.deliveryUrl,
    });

  } catch (err: any) {
    console.error('[LeadMagnet] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
