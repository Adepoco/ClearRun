#!/usr/bin/env node
/**
 * Lint the staged GitHub Action. Checks metadata shape and public copy.
 * Does not install the CLI and does not call the scoring API.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const COPY_FILES = [
  'action/action.yml',
  'action/README.md',
  'action/LICENSE',
  'action/score.js',
  'action/test/score.test.js',
  'docs/ACTION-RELEASE-PLAN.md',
  'docs/README.md',
];

const COLORS = new Set(['white', 'black', 'yellow', 'blue', 'green', 'orange', 'red', 'purple', 'gray-dark']);

function lint(root) {
  const errors = [];
  const read = (rel) => {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      errors.push(`Missing ${rel}`);
      return '';
    }
    return fs.readFileSync(full, 'utf8');
  };

  for (const rel of COPY_FILES) {
    const text = read(rel);
    if (!text) continue;
    if (text.includes('\u2014') || text.includes('\u2013')) {
      errors.push(`${rel} contains an em dash or an en dash`);
    }
    const stripped = text.replaceAll('Generally reliable', '');
    const bannedWord = ['reli', 'able'].join('');
    if (new RegExp(`\\b${bannedWord}\\b`, 'i').test(stripped)) errors.push(`${rel} uses a banned word`);
  }

  const yml = read('action/action.yml');
  const readme = read('action/README.md');
  const score = read('action/score.js');
  if (!yml || !readme || !score) return { ok: false, errors };

  if (!/^name:\s*ClearRun score gate\s*$/m.test(yml)) errors.push('action.yml name must be ClearRun score gate');
  const desc = descriptionOf(yml);
  if (!desc) errors.push('action.yml needs a description');
  else if (desc.length > 125) errors.push(`action.yml description is ${desc.length} characters (max 125)`);
  if (!/not a fact-checker/i.test(desc)) errors.push('action.yml description must say it is not a fact-checker');

  if (!/icon:\s*check-circle\s*$/m.test(yml)) errors.push('action.yml branding icon must be check-circle');
  const color = /color:\s*([A-Za-z-]+)\s*$/m.exec(yml);
  if (!color || !COLORS.has(color[1])) errors.push('action.yml branding color must be a Marketplace color');
  if (!/using:\s*composite\s*$/m.test(yml)) errors.push('action.yml must be a composite action');
  if (!yml.includes('actions/setup-node@v4')) errors.push('action.yml must set up Node with actions/setup-node@v4');
  if (!/node-version:\s*'20'/.test(yml)) errors.push('action.yml must set up Node.js 20');
  if (!yml.includes('action_path }}/score.js')) errors.push('action.yml must run score.js from the action path');

  for (const key of ['paths:', 'threshold:', 'max-issues:', 'config:', 'api-key:', 'json:', 'report-path:']) {
    if (!yml.includes(`\n  ${key}`)) errors.push(`action.yml is missing input ${key}`);
  }
  if (!/api-key:[\s\S]*?required:\s*true/.test(yml)) errors.push('api-key must be required');
  for (const key of ['min-score:', 'passed:', 'report-path:']) {
    if (!yml.includes(`\n  ${key}`)) errors.push(`action.yml is missing output ${key}`);
  }
  if (!yml.includes('steps.score.outputs.min-score')) errors.push('min-score output must map to the score step');
  if (!yml.includes('steps.score.outputs.passed')) errors.push('passed output must map to the score step');
  if (!yml.includes('steps.score.outputs.report-path')) errors.push('report-path output must map to the score step');
  if (yml.includes('--api-key')) errors.push('action.yml must not put the key on a command line');

  if (!score.includes("'@clearrun/cli@1.2.0'") && !score.includes('"@clearrun/cli@1.2.0"')) {
    errors.push('score.js must pin @clearrun/cli@1.2.0');
  }
  if (score.includes('--api-key')) errors.push('score.js must not pass --api-key');
  if (score.includes('console.log') || score.includes('console.error') || score.includes('console.debug')) {
    errors.push('score.js must not use console logging');
  }
  if (!score.includes('::add-mask::')) errors.push('score.js must mask the API key');
  if (/echo\s+.*CLEARRUN_API_KEY/.test(score)) errors.push('score.js must not echo CLEARRUN_API_KEY');

  const readmeNeeds = [
    'https://clearrun.net/ci-gate',
    'not a fact-checker',
    'does not mean the answer is true',
    'API credits',
    'runner',
    'secrets.CLEARRUN_API_KEY',
    'Adepoco/clearrun-action@v1',
    '@clearrun/cli@1.2.0',
    'min-score',
    'at least 3 credits',
  ];
  for (const phrase of readmeNeeds) {
    if (!readme.includes(phrase)) errors.push(`README is missing: ${phrase}`);
  }

  const plan = read('docs/ACTION-RELEASE-PLAN.md');
  for (const phrase of ['v1.0.0', 'v1', 'Adepoco/clearrun-action', 'Code quality', 'Continuous integration', 'Marketplace Developer Agreement']) {
    if (plan && !plan.includes(phrase)) errors.push(`release plan is missing: ${phrase}`);
  }

  return { ok: errors.length === 0, errors };
}

function descriptionOf(yml) {
  const match = /^description:\s*(.+)\s*$/m.exec(yml);
  if (!match) return '';
  let value = match[1].trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  return value;
}

if (require.main === module) {
  const result = lint(ROOT);
  if (!result.ok) {
    console.error('FAIL lint_action_yml: ' + result.errors.length + ' problem(s)');
    for (const error of result.errors) console.error('  - ' + error);
    process.exit(1);
  }
  console.log('PASS lint_action_yml');
}

module.exports = { lint };
