// SPDX-License-Identifier: MIT
// CLI tests. No network: run() gets a stub verify().
// T1 contract (help, flags, config fields), T2 flows (files, dirs, gates),
// T3 edge cases (bad config, missing values, request errors).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HELP, VERSION, CliUsageError, collectFiles, gateFailures, loadConfig, parseArgs, run } from '../src/cli';
import type { PublicVerdict, VerifyOptions } from '../src/verify';

function verdict(score: number, issues: string[] = []): PublicVerdict {
  return {
    score,
    grade: score >= 70 ? 'Generally reliable' : 'Verify before use',
    risk: score >= 70 ? 'low' : 'elevated',
    issues,
    summary: `Summary for ${score}.`,
    verdictId: `v-${score}`,
    timestamp: '2026-10-18T16:00:00.000Z',
  };
}

function harness(scoreFor: (text: string) => PublicVerdict | Error = () => verdict(82), cwd?: string, env: Record<string, string | undefined> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls: Array<{ text: string; options?: VerifyOptions }> = [];
  const deps = {
    cwd: cwd ?? mkdtempSync(join(tmpdir(), 'clearrun-cli-')),
    env,
    stdout: (l: string) => stdout.push(l),
    stderr: (l: string) => stderr.push(l),
    verify: async (text: string, options?: VerifyOptions) => {
      calls.push({ text, options });
      const r = scoreFor(text);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { deps, stdout, stderr, calls, out: () => stdout.join('\n'), err: () => stderr.join('\n') };
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'clearrun-cli-'));
}

// T1: help and version

test('clearrun --help works at the top level (0.1.0 printed "Unknown command: --help")', async () => {
  for (const args of [['--help'], ['-h'], ['help'], ['verify', '--help'], []]) {
    const h = harness();
    assert.equal(await run(args, h.deps), 0, args.join(' '));
    assert.match(h.out(), /Usage:/);
    assert.equal(h.calls.length, 0);
  }
});

test('--version prints the package version', async () => {
  const h = harness();
  assert.equal(await run(['--version'], h.deps), 0);
  assert.equal(h.out(), VERSION);
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  assert.equal(pkg.version, VERSION);
});

test('help copy has no em dash, no mojibake and no banned claims', () => {
  assert.ok(!HELP.includes('\u2014'), 'em dash');
  assert.ok(!HELP.includes('\uFFFD'), 'replacement char');
  assert.doesNotMatch(HELP, /certified|SOC ?2|enterprise-ready/i);
});

test('every flag and config field in the help is implemented', () => {
  for (const flag of ['--api-key', '--base-url', '--config', '--threshold', '--json', '--text', '--version']) {
    assert.ok(HELP.includes(flag), flag);
  }
  const opts = parseArgs(['verify', 'a.txt', '--config', 'c.json', '--threshold', '70', '--api-key', 'k', '--base-url', 'u', '--json']);
  assert.deepEqual(opts.files, ['a.txt']);
  assert.equal(opts.configPath, 'c.json');
  assert.equal(opts.threshold, 70);
  assert.equal(opts.apiKey, 'k');
  assert.equal(opts.baseUrl, 'u');
  assert.equal(opts.json, true);
});

// T3: usage errors

test('unknown command, unknown option and missing values exit 1 with a message', async () => {
  for (const [args, msg] of [
    [['score', 'x.txt'], /Unknown command: score/],
    [['verify', '--nope'], /Unknown option: --nope/],
    [['verify', '--text'], /--text needs a value/],
    [['verify', '--config'], /--config needs a value/],
    [['verify', '--threshold', 'abc', '--text', 'hi'], /--threshold must be a number from 0 to 100/],
    [['verify', '--threshold', '101', '--text', 'hi'], /--threshold must be a number/],
    [['verify', 'missing.txt'], /File not found: missing.txt/],
  ] as Array<[string[], RegExp]>) {
    const h = harness();
    assert.equal(await run(args, h.deps), 1, args.join(' '));
    assert.match(h.err(), msg);
    assert.equal(h.calls.length, 0);
  }
  assert.throws(() => parseArgs(['bogus']), CliUsageError);
});

// T2: single input flows (0.1.0 behavior preserved)

test('verify --text prints the formatted verdict and exits 0', async () => {
  const h = harness(() => verdict(82, ['Hedging missing']));
  assert.equal(await run(['verify', '--text', 'The capital of France is Paris.'], h.deps), 0);
  assert.equal(h.calls[0].text, 'The capital of France is Paris.');
  assert.match(h.out(), /ClearRun Score: 82/);
  assert.match(h.out(), /Grade: Generally reliable/);
  assert.match(h.out(), /Risk: Low/);
  assert.match(h.out(), /\* Hedging missing/);
});

test('verify <file> --json prints the raw verdict', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'r.txt'), 'some answer');
  const h = harness(() => verdict(64), cwd);
  assert.equal(await run(['verify', 'r.txt', '--json'], h.deps), 0);
  assert.equal(JSON.parse(h.out()).score, 64);
});

test('empty input exits 1', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'e.txt'), '   \n');
  const h = harness(undefined, cwd);
  assert.equal(await run(['verify', 'e.txt'], h.deps), 1);
  assert.match(h.err(), /Input text is empty/);
  assert.equal(h.calls.length, 0);
});

test('a failed request exits 1 with the API error', async () => {
  const h = harness(() => new Error('Missing Authorization'));
  assert.equal(await run(['verify', '--text', 'hello'], h.deps), 1);
  assert.match(h.err(), /Error: Missing Authorization/);
});

test('api key and base url precedence: flag, then env, then config', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'clearrun.config.json'), JSON.stringify({ apiKey: 'cfg-key', baseUrl: 'https://cfg.example' }));
  let h = harness(undefined, cwd, {});
  await run(['verify', '--text', 'x'], h.deps);
  assert.deepEqual(h.calls[0].options, { apiKey: 'cfg-key', baseUrl: 'https://cfg.example' });
  h = harness(undefined, cwd, { CLEARRUN_API_KEY: 'env-key' });
  await run(['verify', '--text', 'x'], h.deps);
  assert.equal(h.calls[0].options?.apiKey, 'env-key');
  h = harness(undefined, cwd, { CLEARRUN_API_KEY: 'env-key' });
  await run(['verify', '--text', 'x', '--api-key', 'flag-key', '--base-url', 'https://flag.example'], h.deps);
  assert.deepEqual(h.calls[0].options, { apiKey: 'flag-key', baseUrl: 'https://flag.example' });
});

// T2: config paths, threshold, maxIssues, --config

function project(): string {
  const root = tmp();
  mkdirSync(join(root, 'responses', 'nested'), { recursive: true });
  mkdirSync(join(root, 'responses', 'node_modules'), { recursive: true });
  mkdirSync(join(root, 'responses', '.hidden'), { recursive: true });
  writeFileSync(join(root, 'responses', 'a.txt'), 'answer a');
  writeFileSync(join(root, 'responses', 'nested', 'b.md'), 'answer b');
  writeFileSync(join(root, 'responses', 'image.png'), 'not text');
  writeFileSync(join(root, 'responses', 'node_modules', 'x.txt'), 'skip');
  writeFileSync(join(root, 'responses', '.hidden', 'y.txt'), 'skip');
  writeFileSync(join(root, 'single.txt'), 'answer single');
  return root;
}

test('config "paths" are scored when no file or --text is given', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ paths: ['responses/', 'single.txt'] }));
  const h = harness(() => verdict(80), root);
  assert.equal(await run(['verify'], h.deps), 0);
  assert.deepEqual(h.calls.map((c) => c.text).sort(), ['answer a', 'answer b', 'answer single']);
  assert.match(h.out(), /3 of 3 passed/);
});

test('config "threshold" fails the run when an input scores below it', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ paths: ['responses'], threshold: 70 }));
  const h = harness((t) => verdict(t === 'answer a' ? 90 : 55), root);
  assert.equal(await run(['verify'], h.deps), 1);
  assert.match(h.out(), /score 55 is below threshold 70/);
  assert.match(h.out(), /1 of 2 passed/);
});

test('--threshold overrides config threshold', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ threshold: 90 }));
  const h = harness(() => verdict(75), root);
  assert.equal(await run(['verify', 'single.txt', '--threshold', '70'], h.deps), 0);
  const h2 = harness(() => verdict(75), root);
  assert.equal(await run(['verify', 'single.txt'], h2.deps), 1);
});

test('a null score fails a threshold instead of passing it', () => {
  const v = { ...verdict(0), score: null as unknown as number };
  assert.deepEqual(gateFailures(v, { threshold: 50 }), ['no score, threshold is 50']);
  assert.deepEqual(gateFailures(v, {}), []);
});

test('config "maxIssues" fails inputs with too many issues', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ maxIssues: 1 }));
  const h = harness(() => verdict(90, ['one', 'two']), root);
  assert.equal(await run(['verify', 'single.txt'], h.deps), 1);
  assert.match(h.out(), /2 issues, maxIssues is 1/);
});

test('--config reads another file and resolves its paths relative to that file', async () => {
  const root = project();
  mkdirSync(join(root, 'ci'));
  writeFileSync(join(root, 'ci', 'clear.json'), JSON.stringify({ paths: ['../single.txt'], threshold: 60 }));
  const h = harness(() => verdict(61), root);
  assert.equal(await run(['verify', '--config', 'ci/clear.json'], h.deps), 0);
  assert.deepEqual(h.calls.map((c) => c.text), ['answer single']);
});

test('bad config is reported, not silently ignored', async () => {
  const cases: Array<[string, RegExp]> = [
    ['{not json', /not valid JSON/],
    ['[1,2]', /must contain a JSON object/],
    [JSON.stringify({ paths: 'responses' }), /"paths" must be an array/],
    [JSON.stringify({ threshold: 'high' }), /"threshold" must be a number/],
    [JSON.stringify({ maxIssues: -1 }), /"maxIssues" must be a whole number/],
  ];
  for (const [body, msg] of cases) {
    const root = tmp();
    writeFileSync(join(root, 'clearrun.config.json'), body);
    const h = harness(undefined, root);
    assert.equal(await run(['verify', '--text', 'hi'], h.deps), 1, body);
    assert.match(h.err(), msg);
  }
  const h = harness();
  assert.equal(await run(['verify', '--config', 'nope.json', '--text', 'hi'], h.deps), 1);
  assert.match(h.err(), /Config file not found: nope.json/);
});

test('missing config file is fine when not named explicitly', () => {
  const root = tmp();
  assert.deepEqual(loadConfig(root).config, {});
});

test('collectFiles skips dot folders, node_modules and non-text files', () => {
  const root = project();
  const files = collectFiles(['responses'], root).map((f) => f.slice(root.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(files, ['responses/a.txt', 'responses/nested/b.md']);
});

test('multi-input --json prints one entry per input with pass state', async () => {
  const root = project();
  const h = harness((t) => (t === 'answer a' ? verdict(90) : new Error('boom')), root);
  assert.equal(await run(['verify', 'responses', '--json'], h.deps), 1);
  const rows = JSON.parse(h.out());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].passed, true);
  assert.equal(rows[1].passed, false);
  assert.equal(rows[1].error, 'boom');
});

test('--text and file paths together is a usage error', async () => {
  const h = harness();
  assert.equal(await run(['verify', 'a.txt', '--text', 'x'], h.deps), 1);
  assert.match(h.err(), /either --text or file paths/);
});
