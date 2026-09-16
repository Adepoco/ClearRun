#!/usr/bin/env node
/**
 * Publication integrity: no placeholders in shipped public surface.
 *
 * Scans package sources, schema, and public docs (not tests, not hosted
 * operator docs). Exit 0 = clean; 1 = marker found.
 *
 * Do not put a star-slash sequence in this header (that ends the comment).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MARKERS = [
  { re: /\bTODO\b/i, why: 'TODO' },
  { re: /\bFIXME\b/i, why: 'FIXME' },
  { re: /\bPLACEHOLDER\b/i, why: 'PLACEHOLDER' },
  { re: /\bSTUB(?:BED)?\b/i, why: 'STUB' },
  { re: /\bHACK\b/i, why: 'HACK' },
  { re: /stand-in/i, why: 'stand-in' },
  { re: /\bfor now\b/i, why: 'for now' },
  { re: /not implemented/i, why: 'not implemented' },
  { re: /coming soon/i, why: 'coming soon' },
  { re: /\btemporary\b/i, why: 'temporary' },
  { re: /\bdummy\b/i, why: 'dummy' },
  { re: /\bfake\b/i, why: 'fake' },
  { re: /verified:\s*true/, why: 'verified: true' },
  { re: /hasCredits:\s*true/, why: 'hasCredits: true' },
];

const SKIP_DIR = new Set(['node_modules', 'dist', '.next', '.git', 'test', 'tests']);
const SKIP_FILE_RE = /\.(test|spec)\.(ts|tsx|js|mjs)$/i;

const EXCLUDED_DOCS = new Set([
  'docs/test',
  'docs/SETUP.md',
  'docs/HOSTED.md',
  'docs/RUNBOOK_DEV.md',
  'docs/RUNBOOK_DEPLOY.md',
  'docs/BITM.md',
]);

const findings = [];

function excludedDoc(rel) {
  const n = rel.replace(/\\/g, '/');
  if (n.startsWith('docs/test/')) return true;
  return EXCLUDED_DOCS.has(n);
}

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, fn);
    else if (/\.(ts|tsx|js|mjs|md|json)$/.test(ent.name)) fn(p);
  }
}

function scanFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP_FILE_RE.test(rel)) return;
  if (excludedDoc(rel)) return;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const { re, why } of MARKERS) {
      if (re.test(lines[i])) {
        findings.push({ file: rel, line: i + 1, why, text: lines[i].trim().slice(0, 160) });
        break;
      }
    }
  }
}

for (const pkg of ['cli', 'vendors', 'security', 'core', 'core-types', 'scoring', 'sdk']) {
  walk(path.join(ROOT, 'packages', pkg, 'src'), scanFile);
}

walk(path.join(ROOT, 'schema'), scanFile);
walk(path.join(ROOT, 'docs'), scanFile);

const rootReadme = path.join(ROOT, 'README.md');
if (fs.existsSync(rootReadme)) scanFile(rootReadme);

if (findings.length) {
  console.error('FAIL validate_no_placeholders: ' + findings.length + ' hit(s)');
  for (const f of findings) {
    console.error('  - ' + f.file + ':' + f.line + ' [' + f.why + '] ' + f.text);
  }
  process.exit(1);
}

console.log('PASS validate_no_placeholders: zero markers in shipped public code/docs/schema');
process.exit(0);
