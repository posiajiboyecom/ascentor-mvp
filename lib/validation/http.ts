// lib/validation/http.ts
// Strict request validation for route handlers.
//
//   const parsed = await parseJson(req, schemas.contact);
//   if (!parsed.ok) return parsed.response;      // 400 with field-level issues
//   const { name, email } = parsed.data;          // fully typed, trimmed, normalised
//
// Every body schema is a z.strictObject: unknown keys are REJECTED, not ignored,
// so a client cannot smuggle extra fields past a route into a database write.
import { NextResponse } from 'next/server';
import { z } from 'zod';

export interface Issue {
  path: string;
  message: string;
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

const MAX_BODY_BYTES = 256 * 1024; // refuse absurd payloads before parsing

function issuesOf(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message:
      i.code === 'unrecognized_keys'
        ? `Unexpected field: ${(i as { keys: string[] }).keys.join(', ')}`
        : i.message,
  }));
}

function reject(error: z.ZodError, status = 400): { ok: false; response: NextResponse } {
  const issues = issuesOf(error);
  return {
    ok: false,
    response: NextResponse.json(
      { error: issues[0]?.message ?? 'Invalid request.', issues },
      { status },
    ),
  };
}

/** Parses and validates a JSON request body against a schema. */
export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return { ok: false, response: NextResponse.json({ error: 'Request body too large.' }, { status: 413 }) };
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return { ok: false, response: NextResponse.json({ error: 'Request body too large.' }, { status: 413 }) };
    }
    raw = text.length ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) return reject(result.error);
  return { ok: true, data: result.data };
}

/** Parses and validates URL query parameters against a schema. */
export function parseQuery<S extends z.ZodType>(req: Request, schema: S): Parsed<z.infer<S>> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) return reject(result.error);
  return { ok: true, data: result.data };
}

/** Validates an in-memory value (route params, form fields, webhook payloads). */
export function parseValue<S extends z.ZodType>(value: unknown, schema: S): Parsed<z.infer<S>> {
  const result = schema.safeParse(value);
  if (!result.success) return reject(result.error);
  return { ok: true, data: result.data };
}
