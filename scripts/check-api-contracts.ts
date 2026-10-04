// scripts/check-api-contracts.ts
// Static check: every client-side fetch('/api/...', { body: JSON.stringify({...}) })
// may only send keys that the route's strict schema accepts.
//   npm run check:contracts
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { BODY_SCHEMAS } from '../lib/validation/registry';

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components', 'hooks', 'lib'];
const SKIP = new Set(['node_modules', '.next', '.kilo', 'api']);

function walk(dir: string, out: string[]) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f.name)) out.push(p);
  }
}

function schemaKeys(schema: z.ZodType): Set<string> | null {
  const s = schema as unknown as { def?: { type?: string; shape?: Record<string, unknown> }; shape?: Record<string, unknown> };
  const shape = s.shape ?? s.def?.shape;
  return shape ? new Set(Object.keys(shape)) : null;
}

/** Top-level keys of the object literal that starts at `start` (index of "{"). */
function literalKeys(src: string, start: number): string[] {
  const keys: string[] = [];
  let depth = 0, i = start, token = '', expectKey = true;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') { depth++; if (depth === 1) { expectKey = true; token = ''; continue; } }
    else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) { if (token.trim()) keys.push(token.trim().split(/[:\s]/)[0]); break; } }
    if (depth === 1) {
      if (c === ',') { if (token.trim()) keys.push(token.trim().split(/[:\s]/)[0]); token = ''; expectKey = true; continue; }
      if (expectKey) {
        if (c === ':') { keys.push(token.trim().replace(/^['"]|['"]$/g, '')); token = ''; expectKey = false; continue; }
        token += c;
      }
    }
  }
  return [...new Set(keys.filter((k) => /^[A-Za-z_][\w]*$/.test(k)))];
}

const files: string[] = [];
DIRS.forEach((d) => walk(path.join(ROOT, d), files));

let calls = 0;
const problems: string[] = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /fetch\(\s*([`'"])(\/api\/[A-Za-z0-9/_-]+)(?:\?[^`'"]*)?\1\s*,\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const route = m[2];
    const schema = BODY_SCHEMAS[route];
    if (!schema) continue;
    // the options object ends at the matching brace; find JSON.stringify( inside it
    const optStart = m.index + m[0].length - 1;
    let depth = 0, end = optStart;
    for (; end < src.length; end++) { if (src[end] === '{') depth++; else if (src[end] === '}') { depth--; if (depth === 0) break; } }
    const opts = src.slice(optStart, end + 1);
    const js = opts.indexOf('JSON.stringify(');
    if (js < 0) continue;
    const brace = opts.indexOf('{', js);
    if (brace < 0 || opts.slice(js + 15, brace).trim() !== '') continue; // stringify(variable): skip
    const sent = literalKeys(opts, brace);
    const allowed = schemaKeys(schema);
    calls++;
    if (!allowed) continue;
    const extra = sent.filter((k) => !allowed.has(k));
    if (extra.length) problems.push(`${path.relative(ROOT, file)}  ${route}  sends unknown: ${extra.join(', ')}`);
  }
}

console.log(`checked ${calls} client calls against ${Object.keys(BODY_SCHEMAS).length} schemas`);
if (problems.length) {
  console.log('\nCONTRACT VIOLATIONS (these requests would be rejected by the strict schema):');
  problems.forEach((p) => console.log('  ' + p));
  process.exit(1);
}
console.log('all client payloads match their schemas');
