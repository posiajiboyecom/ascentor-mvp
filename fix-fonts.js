const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\oyedo\\Desktop\\Build\\ascentor-mvp';
const excludeDirs = ['node_modules', '.next', '.git', 'public\\icon'];

const replacements = [
  // CSS variable references
  { pattern: /var\(--font-display,\s*[^)]+\)/gi, replacement: 'Metropolis' },
  { pattern: /var\(--font-body,\s*[^)]+\)/gi, replacement: 'Metropolis' },
  { pattern: /var\(--font-accent,\s*[^)]+\)/gi, replacement: 'Metropolis' },
  
  // Exact font strings
  { pattern: /'Cormorant Garamond',\s*Georgia,\s*serif/g, replacement: "'Metropolis'" },
  { pattern: /'Cormorant Garamond',\s*serif/g, replacement: "'Metropolis'" },
  { pattern: /'Playfair Display',\s*serif/g, replacement: "'Metropolis'" },
  { pattern: /'Plus Jakarta Sans',\s*sans-serif/g, replacement: "'Metropolis'" },
  { pattern: /'Inter',\s*sans-serif/g, replacement: "'Metropolis'" },
  { pattern: /'Syne',\s*sans-serif/g, replacement: "'Metropolis'" },
  { pattern: /'Syne',system-ui,sans-serif/g, replacement: "'Metropolis'" },
  { pattern: /system-ui,\s*sans-serif/g, replacement: "'Metropolis'" },
  { pattern: /system-ui/g, replacement: "'Metropolis'" },
  { pattern: /Georgia/g, replacement: "'Metropolis'" },
  { pattern: /'Plus Jakarta Sans'/g, replacement: "'Metropolis'" },
  { pattern: /'Inter'/g, replacement: "'Metropolis'" },
  { pattern: /'Syne'/g, replacement: "'Metropolis'" },
  { pattern: /'Cormorant Garamond'/g, replacement: "'Metropolis'" },
  { pattern: /'Playfair Display'/g, replacement: "'Metropolis'" },
];

function shouldProcess(filePath) {
  const relPath = path.relative(root, filePath);
  for (const dir of excludeDirs) {
    if (relPath.includes(dir)) return false;
  }
  return /\.(tsx|ts|css)$/.test(filePath);
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const { pattern, replacement } of replacements) {
    content = content.replace(pattern, replacement);
  }
  
  // Clean up duplicate Metropolis
  content = content.replace(/'Metropolis',\s*'Metropolis'/g, "'Metropolis'");
  content = content.replace(/'Metropolis',\s*Metropolis/g, "'Metropolis'");
  content = content.replace(/Metropolis,\s*'Metropolis'/g, "'Metropolis'");
  content = content.replace(/'Metropolis',\s*sans-serif/g, "'Metropolis'");
  content = content.replace(/'Metropolis',\s*serif/g, "'Metropolis'");
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', path.relative(root, filePath));
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (shouldProcess(fullPath)) {
      processFile(fullPath);
    }
  }
}

walkDir(root);
console.log('Font replacement complete');
