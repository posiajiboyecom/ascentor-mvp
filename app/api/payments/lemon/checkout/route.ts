// app/api/payments/lemon/checkout/route.ts
// TOMBSTONE — Lemonsqueezy removed. All payments go through Paystack.
// Returns 410 Gone so any stale client calls fail fast and visibly
// instead of hanging or returning cryptic errors.

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Lemonsqueezy has been removed. All payments now go through Paystack.' },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json({ status: 'removed' }, { status: 410 })
}
