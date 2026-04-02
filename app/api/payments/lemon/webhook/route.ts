// app/api/payments/lemon/webhook/route.ts
// TOMBSTONE — Lemonsqueezy removed. All payments go through Paystack.
// Returns 410 Gone. Remove this file from Lemonsqueezy webhook settings too.

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Lemonsqueezy webhook removed. All payments now go through Paystack.' },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json({ status: 'removed' }, { status: 410 })
}
