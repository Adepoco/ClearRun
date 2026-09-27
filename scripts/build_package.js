#!/usr/bin/env node
/**
 * Clean a workspace package's build artifacts, then run `tsc -b`.
 *
 * `tsc -b` does not remove stale output files on its own, which can leave old
 * files behind in `dist/` and accidentally ship them in `npm pack`.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const packageDir = process.cwd();

for (const target of ['dist', 'tsconfig.tsbuildinfo']) {
  fs.rmSync(path.join(packageDir, target), { recursive: true, force: true });
}

if (!process.env.npm_execpath) {
  throw new Error('npm_execpath is not available; run this script via npm scripts.');
}

execFileSync(process.execPath, [process.env.npm_execpath, 'exec', 'tsc', '--', '-b'], {
  cwd: packageDir,
  stdio: 'inherit',
});
