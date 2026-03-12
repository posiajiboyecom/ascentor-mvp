// ============================================================
// lib/inviteToken.ts
//
// HMAC-signed invite tokens for partner member invitations.
// Replaces raw partner_id URLs with tamper-proof, expiring tokens.
//
// Token format (base64url):
//   payload = JSON { partnerId, email, expiresAt }
//   token   = base64url(payload) + '.' + base64url(HMAC-SHA256(payload))
//
// ENV REQUIRED: APP_SECRET_KEY (same as crypto.ts)
// ============================================================

import { createHmac, timingSafeEqual } from 'crypto';

const SEPARATOR   = '.';
const TOKEN_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function getKey(): string {
  const key = process.env.APP_SECRET_KEY;
  if (!key) throw new Error('APP_SECRET_KEY env var is not set');
  return key;
}

function b64url(buf: Buffer | string): string {
  const str = typeof buf === 'string' ? buf : buf.toString('base64');
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return pad ? padded + '='.repeat(4 - pad) : padded;
}

function sign(payload: string): string {
  return b64url(
    Buffer.from(
      createHmac('sha256', getKey()).update(payload).digest('base64')
    )
  );
}

export interface InvitePayload {
  partnerId:  string;
  email:      string;
  expiresAt:  number; // Unix ms
}

/**
 * Create a signed invite token for a given partner + email.
 * Valid for 7 days.
 */
export function createInviteToken(partnerId: string, email: string): string {
  const payload: InvitePayload = {
    partnerId,
    email:     email.toLowerCase().trim(),
    expiresAt: Date.now() + TOKEN_TTL,
  };
  const encoded = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig     = sign(encoded);
  return `${encoded}${SEPARATOR}${sig}`;
}

/**
 * Verify and decode an invite token.
 * Returns the payload if valid, or throws a descriptive error.
 */
export function verifyInviteToken(token: string): InvitePayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }

  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) {
    throw new Error('Malformed token');
  }

  const [encoded, providedSig] = parts;

  // Constant-time signature comparison (prevents timing attacks)
  const expectedSig = sign(encoded);
  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid token signature');
  }

  let payload: InvitePayload;
  try {
    payload = JSON.parse(
      Buffer.from(fromB64url(encoded), 'base64').toString('utf8')
    ) as InvitePayload;
  } catch {
    throw new Error('Token payload could not be decoded');
  }

  if (!payload.partnerId || !payload.email || !payload.expiresAt) {
    throw new Error('Token payload is incomplete');
  }

  if (Date.now() > payload.expiresAt) {
    throw new Error('Invite link has expired. Please ask the platform owner to resend your invitation.');
  }

  return payload;
}
