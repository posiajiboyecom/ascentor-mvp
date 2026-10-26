import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateSummitTicket } from '@/lib/summitTicket';
import { ticketView, secondFactorMatches } from '@/lib/summitTicketLookup';
import { RateLimiter, getClientIp } from '@/lib/rate-limit';

// "Find my ticket": the registrant proves they are the registrant with the email AND a second detail only they know (the WhatsApp
// number they registered with, or the ES- reference shown on their confirmation screen). Anything else gets the same answer, so
// the page cannot be used to learn who is registered. Limited per IP and per email.
const perIp = new RateLimiter({ limit: 12, windowMs: 10 * 60_000 });
const perEmail = new RateLimiter({ limit: 6, windowMs: 10 * 60_000 });

const body = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(200),
  whatsapp: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(20).optional(),
  format: z.enum(['json', 'pdf']).optional(),
});

const NOT_FOUND = { error: 'We could not find a ticket with those details. Check the email and the WhatsApp number exactly as you registered, or contact us.' };

export async function POST(req: NextRequest) {
  const limited = perIp.check(getClientIp(req));
  if (!limited.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } });

  let parsed;
  try { parsed = body.safeParse(await req.json()); } catch { return NextResponse.json(NOT_FOUND, { status: 404 }); }
  if (!parsed.success || (!parsed.data.whatsapp && !parsed.data.reference)) return NextResponse.json(NOT_FOUND, { status: 404 });
  const { email, whatsapp, reference, format } = parsed.data;

  const byEmail = perEmail.check(email);
  if (!byEmail.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': String(byEmail.retryAfter) } });

  const { data: reg } = await supabaseAdmin.from('summit_registrations').select('*').eq('email', email).maybeSingle();
  if (!reg || reg.payment_status !== 'paid' || !secondFactorMatches(reg, { whatsapp, reference })) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  if (format === 'pdf') {
    const pdf = await generateSummitTicket({
      fullName: reg.full_name, email: reg.email, whatsapp: reg.whatsapp ?? '', organisation: reg.organisation ?? '',
      attendanceType: reg.attendance_type === 'virtual' ? 'virtual' : 'onsite', amountPaid: Number(reg.amount_paid ?? 0), currency: reg.currency ?? 'NGN',
      registrationId: String(reg.id), reference: reg.payment_reference ?? '',
    });
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Elevation-Summit-2026-Ticket.pdf"', 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ticket: await ticketView(reg) }, { headers: { 'Cache-Control': 'no-store' } });
}
