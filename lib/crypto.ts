// ============================================================
// lib/crypto.ts
// AES-256-GCM symmetric encryption for sensitive secrets
// (e.g. partner Paystack keys stored in the database).
//
// Requires env var:
//   ENCRYPTION_KEY — 64-char hex string (32 bytes)
//   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Format of encrypted output (all base64, colon-separated):
//   <iv_base64>:<authTag_base64>:<ciphertext_base64>
//
// This format is self-contained — no external state needed to decrypt.
// ============================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_PREFIX = 'enc:v1:'; // version sentinel so we can detect & future-proof

// ── Key loading ───────────────────────────────────────────────────────────────

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[crypto] ENCRYPTION_KEY env var is missing or invalid. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a prefixed, colon-separated string safe to store in the database.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag

  return (
    ENCRYPTED_PREFIX +
    iv.toString('base64') + ':' +
    authTag.toString('base64') + ':' +
    encrypted.toString('base64')
  );
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypts a value previously produced by encryptSecret().
 * Throws if the value is tampered, the key is wrong, or the format is invalid.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('[crypto] Value does not appear to be encrypted by this module.');
  }

  const payload = stored.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('[crypto] Encrypted value has unexpected format.');
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key        = getKey();
  const iv         = Buffer.from(ivB64,        'base64');
  const authTag    = Buffer.from(authTagB64,   'base64');
  const ciphertext = Buffer.from(ciphertextB64,'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if auth tag doesn't match (tamper detection)
  ]);

  return decrypted.toString('utf8');
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the value looks like it was already encrypted by encryptSecret().
 * Use this before encrypting to avoid double-encrypting on re-submission.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Returns true if the value is a non-empty string that is NOT yet encrypted.
 * Convenience helper for settings routes.
 */
export function isPlaintext(value: string): boolean {
  return Boolean(value) && !isEncrypted(value);
}
