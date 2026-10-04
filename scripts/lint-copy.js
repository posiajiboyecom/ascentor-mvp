#!/usr/bin/env node
// scripts/lint-copy.js
// Repository copy rules: no em dashes, no emoji, in source or documentation.
//   node scripts/lint-copy.js          report violations (exit 1 if any)
//   node scripts/lint-copy.js --fix    rewrite em dashes automatically
//
// Em dashes are rewritten to a plain hyphen with the surrounding spacing kept.
// Emoji are never auto-fixed: they need a deliberate replacement (an icon, or
// plain words), so they are reported with file and line.
const fs = require('fs');
const path = require('path');

const ROOTS = ['app', 'components', 'lib', 'hooks', 'types', 'styles', 'database', 'scripts', 'src',
  'supabase', 'public/manifest.json', 'proxy.ts', 'next.config.ts', 'README.md', 'wiki.md',
  'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs'];
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.sql', '.md', '.json', '.mdx']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.kilo', '.git', 'generated']);
// Legacy copies kept only for history; excluded from enforcement.
const SKIP_PREFIX = ['app/nav/', 'nav/'];

const EM_DASH = /—/g;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️⃣]/gu;
// Typographic symbols used as UI glyphs (arrows, stars, bullets) count as emoji-style decoration.
const GLYPHS = /[✓✔✕✖★☆◆◇◎✦✧✨•●○→←↑↓↗×]/gu;

const fix = process.argv.includes('--fix');
let emDashHits = 0;
let emojiHits = [];
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
for (const r of ROOTS) walk(r, files);

for (const file of files) {
  const rel = file.replace(/\\/g, '/');
  if (SKIP_PREFIX.some((s) => rel.startsWith(s))) continue;
  let text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(EMOJI);
    if (m) emojiHits.push(`${rel}:${i + 1}  ${m.join(' ')}`);
  });
  const count = (text.match(EM_DASH) || []).length;
  if (count) {
    emDashHits += count;
    if (fix) {
      text = text.replace(EM_DASH, '-');
      fs.writeFileSync(file, text);
      filesChanged++;
    } else {
      console.log(`em dash x${count}  ${rel}`);
    }
  }
}

console.log(`\nem dashes: ${emDashHits}${fix ? ` (fixed in ${filesChanged} files)` : ''}`);
console.log(`emoji: ${emojiHits.length}`);
emojiHits.slice(0, 400).forEach((h) => console.log('  ' + h));
process.exit((fix ? 0 : emDashHits) + emojiHits.length > 0 ? 1 : 0);
