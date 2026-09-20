// One-off / re-runnable: store Paystack's REAL fee for every paid Summit ticket
// that has none yet. Reads PAYSTACK_SECRET_KEY and DATABASE_URL from .env.local
// (never printed).
//
//   npx tsx scripts/backfill-paystack-fees.ts            # dry run, changes nothing
//   npx tsx scripts/backfill-paystack-fees.ts --write    # saves the fees
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: '.env.local' });

type Row = { id: string; full_name: string; email: string; amount_paid: string; payment_reference: string; payment_provider_tx_id: string | null };

async function main() {
  const write = process.argv.includes('--write');
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not set in .env.local');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in .env.local');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `select id, full_name, email, amount_paid::text, payment_reference, payment_provider_tx_id
         from summit_registrations
        where payment_status = 'paid' and paystack_fee is null and payment_reference is not null
        order by paid_at`,
    );
    console.log(`${rows.length} paid ticket(s) without a stored fee. Mode: ${write ? 'WRITE' : 'dry run'}\n`);

    for (const r of rows) {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(r.payment_reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body: any = await res.json().catch(() => null);
      const tx = body?.data;
      if (!res.ok || !body?.status || !tx) {
        console.log(`SKIP  ${r.full_name} <${r.email}>: Paystack said "${body?.message ?? res.status}"`);
        continue;
      }
      if (tx.status !== 'success') { console.log(`SKIP  ${r.full_name}: Paystack status is ${tx.status}`); continue; }

      const paidNaira = tx.amount / 100;
      const feeNaira = (tx.fees ?? 0) / 100;
      const match = Number(r.amount_paid) === paidNaira ? 'amount matches' : `AMOUNT MISMATCH (db ${r.amount_paid})`;
      console.log(`${write ? 'SAVE ' : 'FOUND'} ${r.full_name} <${r.email}>: paid ₦${paidNaira}, Paystack fee ₦${feeNaira} (net ₦${paidNaira - feeNaira}), ${tx.domain ?? '?'} mode, ${match}`);

      if (write && tx.fees != null && Number(r.amount_paid) === paidNaira) {
        await prisma.$executeRawUnsafe(`update summit_registrations set paystack_fee = $1 where id = $2::uuid`, feeNaira, r.id);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
