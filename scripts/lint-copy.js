#!/usr/bin/env node
// scripts/lint-copy.js
// Repository copy rules, enforced in source and documentation:
//   1. no em dashes (U+2014), literal or written as an escape / HTML entity
//   2. no emoji or pictographic symbols (copyright sign and plain arrows are allowed)
//
//   node scripts/lint-copy.js          report violations, exit 1 if any
//   node scripts/lint-copy.js --fix    rewrite em dashes to a hyphen (emoji are never
//                                      auto-fixed: they need a deliberate replacement)
const fs = require('fs');
const path = require('path');

const ROOTS = ['app', 'components', 'lib', 'hooks', 'types', 'styles', 'database', 'scripts', 'src',
  'supabase', 'public/manifest.json', 'proxy.ts', 'next.config.ts', 'README.md', 'wiki.md',
  'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs'];
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.sql', '.md', '.json', '.mdx']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.kilo', '.git', 'generated']);

const EM = String.fromCharCode(0x2014);
const EM_RE = new RegExp(EM, 'g');
const EM_ESCAPES = ['\\' + 'u2014', '&mdash;', '&#8212;', '&#x2014;'];

// Pictographs, flags, and variation selectors. Allowed: copyright/registered/trademark
// signs and the arrow block (U+2190 to U+21FF), which are ordinary typography.
// Decorative symbol blocks (technical, geometric shapes, misc symbols, dingbats) are banned
// as UI glyphs too; box-drawing characters in code comments are not affected.
const PICT = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
function isAllowed(ch) {
  const c = ch.codePointAt(0);
  // keyboard modifier symbols (command, escape, return) are ordinary typography
  if (c === 0x2318 || c === 0x238b || c === 0x23ce || c === 0x2325) return true;
  return c === 0xa9 || c === 0xae || c === 0x2122 || (c >= 0x2190 && c <= 0x21ff);
}
// Pictographs written as \uXXXX / \u{...} escapes inside string literals.
const ESC_RE = /\\u\{([0-9a-fA-F]{4,6})\}|\\u([0-9a-fA-F]{4})/g;

const fix = process.argv.includes('--fix');
const dashHits = [];
const emojiHits = [];
let filesChanged = 0;

function walk(p, out) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(p))) return;
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  } else if (EXT.has(path.extname(p))) {
    out.push(p);
  }
}

const files = [];
ROOTS.forEach((r) => walk(r, files));

for (const file of files) {
  const rel = file.split(path.sep).join('/');
  if (rel === 'scripts/lint-copy.js') continue;
  // Generated snapshot of the live schema: column defaults there are data, not authored copy.
  if (rel === 'database/migrations/00000000_baseline.sql') continue;
  let text = fs.readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const ch of line.match(PICT) || []) {
      if (!isAllowed(ch)) emojiHits.push(`${rel}:${i + 1}  ${ch}`);
    }
    let m;
    ESC_RE.lastIndex = 0;
    while ((m = ESC_RE.exec(line))) {
      const cp = parseInt(m[1] || m[2], 16);
      const ch = String.fromCodePoint(cp);
      if (/\p{Extended_Pictographic}/u.test(ch) && !isAllowed(ch)) {
        emojiHits.push(`${rel}:${i + 1}  \\u${cp.toString(16)}`);
      }
    }
    const n = (line.match(EM_RE) || []).length + EM_ESCAPES.filter((e) => line.includes(e)).length;
    if (n) dashHits.push(`${rel}:${i + 1}`);
  });
  if (fix && text.includes(EM)) {
    fs.writeFileSync(file, text.replace(EM_RE, '-'));
    filesChanged++;
  }
}

if (!fix) dashHits.slice(0, 200).forEach((h) => console.log('em dash  ' + h));
console.log(`em dashes: ${dashHits.length}${fix ? ` (literal ones rewritten in ${filesChanged} files)` : ''}`);
console.log(`emoji / pictographs: ${emojiHits.length}`);
emojiHits.slice(0, 400).forEach((h) => console.log('  ' + h));
process.exit((fix ? 0 : dashHits.length) + emojiHits.length > 0 ? 1 : 0);
