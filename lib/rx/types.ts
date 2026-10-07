// lib/rx/types.ts
// Types safe to import from both server and client code.
export type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };
