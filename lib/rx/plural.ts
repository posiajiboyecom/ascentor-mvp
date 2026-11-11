// lib/rx/plural.ts
// "1 member", "2 members", "0 members". No server-only import: used by client and server components.

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}

export const members = (n: number) => plural(n, 'member');
