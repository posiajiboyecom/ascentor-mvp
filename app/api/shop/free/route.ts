// POST /api/shop/free: lead magnet for FREE shop items.
// Name + email in, lead recorded (and added to MailerLite), download link returned and emailed.
// Only products that are free, published and have a file can be fetched this way.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { addOrUpdateSubscriber } from '@/lib/mailerlite';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, esc, goldButton, p } from '@/lib/emailTemplate';
import { parseJson } from '@/lib/validation/http';
import * as commerceSchemas from '@/lib/validation/schemas/commerce';
import { freeDownloadUrl } from '@/lib/shop';
import { limitPublic } from '@/lib/security';

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';

export async function POST(req: NextRequest) {
  const limited = await limitPublic(req, 'shop-free', 10, 600);
  if (limited) return limited;
  const parsed = await parseJson(req, commerceSchemas.shopFree);
  if (!parsed.ok) return parsed.response;
  const { productId, fullName, email } = parsed.data;

  const { data: product } = await supabaseAdmin
    .from('products').select('id, name, price_ngn, published, file_path, fulfilment').eq('id', productId).maybeSingle();
  if (!product || !product.published || product.price_ngn > 0 || product.fulfilment !== 'digital' || !product.file_path) {
    return NextResponse.json({ error: 'That item is not available as a free download.' }, { status: 404 });
  }

  await supabaseAdmin.from('shop_leads').insert({ product_id: product.id, email, full_name: fullName });
  try {
    await addOrUpdateSubscriber({
      email, firstName: fullName.split(' ')[0], groups: [],
      fields: { lead_magnet: product.name, lead_source: 'shop' },
    });
  } catch (e) {
    console.error('[shop/free] MailerLite error:', (e as Error).message); // non-fatal
  }

  const url = freeDownloadUrl(APP_URL, product.id, email);
  // Best-effort copy by email; the link is also returned so the buyer is never stuck waiting on mail.
  sendEmail({
    to: email,
    subject: `Your download: ${product.name}`,
    html: brandedEmailLayout({
      preheader: `Your copy of ${product.name}`, eyebrow: 'Shop', heading: 'Your download is ready.', recipient: email,
      content: p(`Hi ${esc(fullName.split(' ')[0])}, here is your copy of <strong>${esc(product.name)}</strong>.`) + goldButton('Download', url) + p('The Ascentor Team'),
    }),
  }).catch((e) => console.error('[shop/free] email failed:', e));

  return NextResponse.json({ ok: true, url });
}
