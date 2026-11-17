import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as publicSchemas from '@/lib/validation/schemas/public';
import { limitPublic } from '@/lib/security';

// ═══════════════════════════════════════════════════════════
// POST /api/lead-magnet
// Handles opt-in for all lead magnets.
// 1. Records download/opt-in in Supabase for admin tracking
// ═══════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Magnet config ─────────────────────────────────────────
const MAGNETS: Record<string, {
  name: string;
  deliveryUrl: string;
  confirmationSubject: string;
}> = {
  // ── Lead Magnet 1: The 90-Day Leadership Playbook ──────────
  'leadership-playbook': {
    name: 'The 90-Day Leadership Playbook',
    deliveryUrl: '/free/leadership-playbook/download',
    confirmationSubject: 'Your 90-Day Leadership Playbook is ready',
  },
  // ── Lead Magnet 2: Why Talented People Don't Get Promoted ──
  'promotion-blueprint': {
    name: "Why Talented People Don't Get Promoted",
    deliveryUrl: '/free/promotion-blueprint/download',
    confirmationSubject: "Your guide: Why Talented People Don't Get Promoted",
  },
  // ── Lead Magnet 3: Salary Negotiation Script Pack ──────────
  'salary-scripts': {
    name: 'The Salary Negotiation Script Pack',
    deliveryUrl: '/free/salary-scripts/download',
    confirmationSubject: 'Your Salary Negotiation Scripts are ready',
  },
  // ── Lead Magnet 4: Career Clarity Audit (Phase 2) ──────────
  'career-audit': {
    name: 'The 10-Minute Career Clarity Audit',
    deliveryUrl: '/free/career-audit/results',
    confirmationSubject: 'Your Career Clarity Audit results',
  },
  // ── Legacy IDs (backwards compatibility) ───────────────────
  'leadership-blueprint': {
    name: 'The 90-Day Leadership Playbook',
    deliveryUrl: '/free/leadership-playbook/download',
    confirmationSubject: 'Your 90-Day Leadership Playbook is ready',
  },
  'salary-toolkit': {
    name: 'The Salary Negotiation Script Pack',
    deliveryUrl: '/free/salary-scripts/download',
    confirmationSubject: 'Your Salary Negotiation Scripts are ready',
  },
};

export async function POST(req: NextRequest) {
  const limited = await limitPublic(req, 'lead-magnet', 10, 600);
  if (limited) return limited;
  try {
    const parsed = await parseJson(req, publicSchemas.leadMagnet);
    if (!parsed.ok) return parsed.response;
    const { magnetId, email, firstName, source } = parsed.data;

    const magnet = MAGNETS[magnetId];
    if (!magnet) {
      return NextResponse.json({ error: 'Unknown magnet' }, { status: 400 });
    }

    const emailClean = email.trim().toLowerCase();
    // Track in Supabase ────────────────────────────────
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
      // Non-fatal - table may not exist yet
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
