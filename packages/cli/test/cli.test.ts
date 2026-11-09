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
import { lookupVerdict, scoreText, type LookupResult, type PublicVerdict, type VerifyOptions } from '../src/verify';

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

function harness(scoreFor: (text: string) => PublicVerdict | Error = () => verdict(82), cwd?: string, env?: Record<string, string | undefined>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls: Array<{ text: string; options?: VerifyOptions }> = [];
  const lookups: Array<{ verdictId: string; options?: VerifyOptions }> = [];
  let onLookup: (verdictId: string, options?: VerifyOptions) => LookupResult | Promise<LookupResult> = async () => ({
    verified: false,
  });
  const dir = cwd ?? mkdtempSync(join(tmpdir(), 'clearrun-cli-'));
  const home = mkdtempSync(join(tmpdir(), 'clearrun-home-'));
  // Omitted env gets a key so existing score tests still reach the stub.
  // Pass env explicitly (even {}) to exercise the missing-key path.
  const provided = env === undefined ? { CLEARRUN_API_KEY: 'cr_test_key_not_a_secret' } : env;
  const deps = {
    cwd: dir,
    env: { HOME: home, ...provided },
    stdout: (l: string) => stdout.push(l),
    stderr: (l: string) => stderr.push(l),
    score: async (text: string, options?: VerifyOptions) => {
      calls.push({ text, options });
      const r = scoreFor(text);
      if (r instanceof Error) throw r;
      return r;
    },
    lookup: async (verdictId: string, options?: VerifyOptions) => {
      lookups.push({ verdictId, options });
      return onLookup(verdictId, options);
    },
  };
  return {
    deps,
    stdout,
    stderr,
    calls,
    lookups,
    setLookup: (fn: typeof onLookup) => {
      onLookup = fn;
    },
    out: () => stdout.join('\n'),
    err: () => stderr.join('\n'),
  };
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'clearrun-cli-'));
}

// T1: help and version

test('clearrun --help works at the top level (0.1.0 printed "Unknown command: --help")', async () => {
  for (const args of [['--help'], ['-h'], ['help'], ['score', '--help'], ['verify', '--help'], []]) {
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
  const opts = parseArgs(['score', 'a.txt', '--config', 'c.json', '--threshold', '70', '--api-key', 'k', '--base-url', 'u', '--json']);
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
    [['grade', 'x.txt'], /Unknown command: grade/],
    [['score', '--nope'], /Unknown option: --nope/],
    [['score', '--text'], /--text needs a value/],
    [['score', '--config'], /--config needs a value/],
    [['score', '--threshold', 'abc', '--text', 'hi'], /--threshold must be a number from 0 to 100/],
    [['score', '--threshold', '101', '--text', 'hi'], /--threshold must be a number/],
    [['score', 'missing.txt'], /File not found: missing.txt/],
  ] as Array<[string[], RegExp]>) {
    const h = harness();
    assert.equal(await run(args, h.deps), 1, args.join(' '));
    assert.match(h.err(), msg);
    assert.equal(h.calls.length, 0);
  }
  assert.throws(() => parseArgs(['bogus']), CliUsageError);
});

// T2: single input flows (0.1.0 behavior preserved)

test('score --text prints the formatted verdict and exits 0', async () => {
  const h = harness(() => verdict(82, ['Hedging missing']));
  assert.equal(await run(['score', '--text', 'The capital of France is Paris.'], h.deps), 0);
  assert.equal(h.calls[0].text, 'The capital of France is Paris.');
  assert.match(h.out(), /ClearRun Score: 82/);
  assert.match(h.out(), /Grade: Generally reliable/);
  assert.match(h.out(), /Risk: Low/);
  assert.match(h.out(), /\* Hedging missing/);
});

test('one input --json includes the pass bit on a hit and on a threshold miss', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'r.txt'), 'some answer');
  const ok = harness(() => verdict(64), cwd);
  assert.equal(await run(['score', 'r.txt', '--json'], ok.deps), 0);
  const good = JSON.parse(ok.out()) as { passed: boolean; results: Array<{ passed: boolean; verdict: { score: number } }> };
  assert.equal(good.passed, true);
  assert.equal(good.results.length, 1);
  assert.equal(good.results[0].passed, true);
  assert.equal(good.results[0].verdict.score, 64);

  const missed = harness(() => verdict(64), cwd);
  assert.equal(await run(['score', 'r.txt', '--json', '--threshold', '70'], missed.deps), 1);
  const bad = JSON.parse(missed.out()) as {
    passed: boolean;
    results: Array<{ passed: boolean; verdict: { score: number }; failures: string[] }>;
  };
  assert.equal(bad.passed, false);
  assert.equal(bad.results.length, 1);
  assert.equal(bad.results[0].passed, false);
  assert.equal(bad.results[0].verdict.score, 64);
  assert.match(bad.results[0].failures[0], /below threshold 70/);
});

test('empty input exits 1', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'e.txt'), '   \n');
  const h = harness(undefined, cwd);
  assert.equal(await run(['score', 'e.txt'], h.deps), 1);
  assert.match(h.err(), /Input text is empty/);
  assert.equal(h.calls.length, 0);
});

test('a failed request exits 1 with the API error', async () => {
  const h = harness(() => new Error('Missing Authorization'));
  assert.equal(await run(['score', '--text', 'hello'], h.deps), 1);
  assert.match(h.err(), /Error: Missing Authorization/);
});

test('api key and base url precedence: flag, then env, then config', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'clearrun.config.json'), JSON.stringify({ apiKey: 'cfg-key', baseUrl: 'https://cfg.example' }));
  let h = harness(undefined, cwd, {});
  await run(['score', '--text', 'x'], h.deps);
  assert.deepEqual(h.calls[0].options, { apiKey: 'cfg-key', baseUrl: 'https://cfg.example' });
  h = harness(undefined, cwd, { CLEARRUN_API_KEY: 'env-key' });
  await run(['score', '--text', 'x'], h.deps);
  assert.equal(h.calls[0].options?.apiKey, 'env-key');
  h = harness(undefined, cwd, { CLEARRUN_API_KEY: 'env-key' });
  await run(['score', '--text', 'x', '--api-key', 'flag-key', '--base-url', 'https://flag.example'], h.deps);
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
  assert.equal(await run(['score'], h.deps), 0);
  assert.deepEqual(h.calls.map((c) => c.text).sort(), ['answer a', 'answer b', 'answer single']);
  assert.match(h.out(), /3 of 3 passed/);
});

test('config "threshold" fails the run when an input scores below it', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ paths: ['responses'], threshold: 70 }));
  const h = harness((t) => verdict(t === 'answer a' ? 90 : 55), root);
  assert.equal(await run(['score'], h.deps), 1);
  assert.match(h.out(), /score 55 is below threshold 70/);
  assert.match(h.out(), /1 of 2 passed/);
});

test('--threshold overrides config threshold', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ threshold: 90 }));
  const h = harness(() => verdict(75), root);
  assert.equal(await run(['score', 'single.txt', '--threshold', '70'], h.deps), 0);
  const h2 = harness(() => verdict(75), root);
  assert.equal(await run(['score', 'single.txt'], h2.deps), 1);
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
  assert.equal(await run(['score', 'single.txt'], h.deps), 1);
  assert.match(h.out(), /2 issues, maxIssues is 1/);
});

test('--config reads another file and resolves its paths relative to that file', async () => {
  const root = project();
  mkdirSync(join(root, 'ci'));
  writeFileSync(join(root, 'ci', 'clear.json'), JSON.stringify({ paths: ['../single.txt'], threshold: 60 }));
  const h = harness(() => verdict(61), root);
  assert.equal(await run(['score', '--config', 'ci/clear.json'], h.deps), 0);
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
    assert.equal(await run(['score', '--text', 'hi'], h.deps), 1, body);
    assert.match(h.err(), msg);
  }
  const h = harness();
  assert.equal(await run(['score', '--config', 'nope.json', '--text', 'hi'], h.deps), 1);
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

test('multi-input --json uses the same shape as one input, with a pass bit', async () => {
  const root = project();
  const h = harness((t) => (t === 'answer a' ? verdict(90) : new Error('boom')), root);
  assert.equal(await run(['score', 'responses', '--json'], h.deps), 1);
  const body = JSON.parse(h.out()) as {
    passed: boolean;
    results: Array<{ passed: boolean; error?: string }>;
  };
  assert.equal(body.passed, false);
  assert.equal(body.results.length, 2);
  assert.equal(body.results[0].passed, true);
  assert.equal(body.results[1].passed, false);
  assert.equal(body.results[1].error, 'boom');
});

test('--text and file paths together is a usage error', async () => {
  const h = harness();
  assert.equal(await run(['score', 'a.txt', '--text', 'x'], h.deps), 1);
  assert.match(h.err(), /either --text or file paths/);
});

test('an explicit directory with no text files exits 1 and does not score', async () => {
  const root = tmp();
  mkdirSync(join(root, 'empty', 'nested'), { recursive: true });
  writeFileSync(join(root, 'empty', 'notes.png'), 'x');
  const plain = harness(undefined, root);
  assert.equal(await run(['score', 'empty'], plain.deps), 1);
  assert.match(plain.err(), /No \.txt or \.md files found in empty/);
  assert.doesNotMatch(`${plain.out()}\n${plain.err()}`, /0 of 0/);
  assert.equal(plain.calls.length, 0);

  const gated = harness(undefined, root);
  assert.equal(await run(['score', 'empty', '--threshold', '70'], gated.deps), 1);
  assert.doesNotMatch(`${gated.out()}\n${gated.err()}`, /0 of 0/);
  assert.equal(gated.calls.length, 0);

  const json = harness(undefined, root);
  assert.equal(await run(['score', 'empty', '--json'], json.deps), 1);
  const body = JSON.parse(json.out()) as { passed: boolean; error: string };
  assert.equal(body.passed, false);
  assert.match(body.error, /No \.txt or \.md files found in empty/);
  assert.equal(json.calls.length, 0);
});

test('config paths with no text files exit 1, and --json is an error document', async () => {
  const root = tmp();
  mkdirSync(join(root, 'empty'));
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ paths: ['empty'] }));
  const text = harness(undefined, root);
  assert.equal(await run(['score'], text.deps), 1);
  assert.match(text.err(), /No \.txt or \.md files found in config "paths"/);
  assert.doesNotMatch(`${text.out()}\n${text.err()}`, /0 of 0/);
  assert.equal(text.calls.length, 0);

  const json = harness(undefined, root);
  assert.equal(await run(['score', '--json'], json.deps), 1);
  const body = JSON.parse(json.out()) as { passed: boolean; error: string };
  assert.equal(body.passed, false);
  assert.match(body.error, /No \.txt or \.md files found in config "paths"/);
});

test('a failed score with --json is parseable and includes passed false', async () => {
  const h = harness(() => new Error('Missing Authorization'));
  assert.equal(await run(['score', '--text', 'hello', '--json'], h.deps), 1);
  const body = JSON.parse(h.out()) as { passed: boolean; results: Array<{ passed: boolean; error: string }> };
  assert.equal(body.passed, false);
  assert.equal(body.results[0].passed, false);
  assert.equal(body.results[0].error, 'Missing Authorization');
});

test('empty input with --json includes passed false', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'e.txt'), '   \n');
  const h = harness(undefined, cwd);
  assert.equal(await run(['score', 'e.txt', '--json'], h.deps), 1);
  const body = JSON.parse(h.out()) as { passed: boolean; results: Array<{ error: string }> };
  assert.equal(body.passed, false);
  assert.match(body.results[0].error, /Input text is empty/);
  assert.equal(h.calls.length, 0);
});

test('a null score exits 0 when no threshold is set and exits 1 when one is', async () => {
  const open = harness(() => ({ ...verdict(0), score: null as unknown as number }));
  assert.equal(await run(['score', '--text', 'x'], open.deps), 0);
  assert.match(open.out(), /not determined/);

  const gated = harness(() => ({ ...verdict(0), score: null as unknown as number }));
  assert.equal(await run(['score', '--text', 'x', '--threshold', '50'], gated.deps), 1);
  assert.match(gated.out(), /no score, threshold is 50/);
});

test('docs say a null score fails only when a threshold is set', () => {
  const developers = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'developers.md'), 'utf8');
  const readme = readFileSync(join(__dirname, '..', 'README.md'), 'utf8');
  const sentence = 'A null score fails the run only when a threshold is set.';
  assert.ok(developers.includes(sentence), 'developers.md');
  assert.ok(readme.includes(sentence), 'cli README');
  assert.equal(developers.includes('has no score, has more issues'), false);
});

test('clearrun verify looks up an id and does not score', async () => {
  const h = harness();
  h.setLookup(async (verdictId) => ({ verified: verdictId === 'v-82', verdict: verdict(82) }));
  assert.equal(await run(['verify', 'v-82'], h.deps), 0);
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.lookups.map((call) => call.verdictId), ['v-82']);
  assert.equal(h.lookups[0].options?.apiKey, undefined);
  assert.match(h.out(), /Verified: yes/);
  assert.match(h.out(), /ClearRun Score: 82/);
});

test('clearrun verify --text does not spend a score call', async () => {
  const h = harness();
  assert.equal(await run(['verify', '--text', 'v-82'], h.deps), 1);
  assert.equal(h.calls.length, 0);
  assert.equal(h.lookups.length, 0);
  assert.match(h.err(), /does not score text/);
  assert.match(h.err(), /clearrun score --text/);
});

test('clearrun verify of a file path tells you to score it', async () => {
  const cwd = tmp();
  writeFileSync(join(cwd, 'answer.txt'), 'The capital of France is Paris.');
  const h = harness(undefined, cwd);
  assert.equal(await run(['verify', 'answer.txt'], h.deps), 1);
  assert.equal(h.calls.length, 0);
  assert.equal(h.lookups.length, 0);
  assert.match(h.err(), /clearrun score answer\.txt/);
});

test('clearrun verify without a key still looks up and does not score', async () => {
  const h = harness(undefined, undefined, {});
  h.setLookup(async () => ({ verified: true, verdict: verdict(70) }));
  assert.equal(await run(['verify', 'v-70'], h.deps), 0);
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.lookups.map((call) => call.verdictId), ['v-70']);
  assert.doesNotMatch(h.err(), /CLEARRUN_API_KEY/);
});

test('an unverified id exits 1 and --json uses the same pass shape for one id and many', async () => {
  const one = harness();
  one.setLookup(async () => ({ verified: false }));
  assert.equal(await run(['verify', 'missing', '--json'], one.deps), 1);
  const single = JSON.parse(one.out()) as {
    passed: boolean;
    results: Array<{ verdictId: string; passed: boolean; verified: boolean }>;
  };
  assert.equal(single.passed, false);
  assert.equal(single.results.length, 1);
  assert.equal(single.results[0].verdictId, 'missing');
  assert.equal(single.results[0].passed, false);
  assert.equal(single.results[0].verified, false);
  assert.match(one.out(), /Verified: no|verified/);
  assert.equal(one.calls.length, 0);

  const many = harness();
  many.setLookup(async (id) => (id === 'good' ? { verified: true, verdict: verdict(90) } : { verified: false }));
  assert.equal(await run(['verify', 'good', 'missing', '--json'], many.deps), 1);
  const body = JSON.parse(many.out()) as {
    passed: boolean;
    results: Array<{ verdictId: string; passed: boolean; verified: boolean; verdict?: { score: number } }>;
  };
  assert.equal(body.passed, false);
  assert.equal(body.results.length, 2);
  assert.equal(body.results[0].passed, true);
  assert.equal(body.results[0].verdict?.score, 90);
  assert.equal(body.results[1].passed, false);
  assert.equal(body.results[1].verified, false);
  assert.equal(many.calls.length, 0);
});

test('a verify lookup failure with --json is parseable and does not score', async () => {
  const h = harness();
  h.setLookup(async () => {
    throw new Error('ClearRun did not return a verification result.');
  });
  assert.equal(await run(['verify', 'v1', '--json'], h.deps), 1);
  const body = JSON.parse(h.out()) as {
    passed: boolean;
    results: Array<{ passed: boolean; verified: boolean; error: string }>;
  };
  assert.equal(body.passed, false);
  assert.equal(body.results[0].passed, false);
  assert.equal(body.results[0].verified, false);
  assert.match(body.results[0].error, /verification result/);
  assert.doesNotMatch(body.results[0].error, /invalid/i);
  assert.equal(h.calls.length, 0);
});

test('clearrun verify does not score config paths', async () => {
  const root = project();
  writeFileSync(join(root, 'clearrun.config.json'), JSON.stringify({ paths: ['responses/'] }));
  const h = harness(undefined, root);
  assert.equal(await run(['verify'], h.deps), 1);
  assert.equal(h.calls.length, 0);
  assert.equal(h.lookups.length, 0);
  assert.match(h.err(), /verdict id/);
});

test('score --text of a verdict id scores that string, verify looks it up', async () => {
  const scored = harness();
  assert.equal(await run(['score', '--text', 'v-82'], scored.deps), 0);
  assert.equal(scored.calls[0].text, 'v-82');
  assert.equal(scored.lookups.length, 0);

  const looked = harness();
  looked.setLookup(async (id) => ({ verified: id === 'v-82', verdict: verdict(82) }));
  assert.equal(await run(['verify', 'v-82'], looked.deps), 0);
  assert.equal(looked.calls.length, 0);
  assert.deepEqual(looked.lookups.map((call) => call.verdictId), ['v-82']);
});

const fullVerdict = {
  verdictId: 'v1',
  schemaVersion: '1.0.0',
  scoringVersion: 'ck-1.0.0',
  score: 82,
  grade: 'Generally reliable' as const,
  risk: 'low' as const,
  failureCategories: [],
  confidenceInterval: { min: 74, max: 90 },
  summary: 'Confidence matches the reasoning.',
  issues: ['Hedging missing'],
  timestamp: '2026-01-08T00:00:00.000Z',
  signature: 'sig-example',
};

test('scoreText posts to /api/score and lookupVerdict gets /api/verify without a key', async () => {
  const calls: Array<{ url: string; method?: string; authorization?: string; body?: string }> = [];
  const fetch = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    calls.push({
      url,
      method: init?.method,
      authorization: init?.headers?.Authorization,
      body: init?.body,
    });
    if (url.includes('/api/verify/')) {
      return { ok: true, status: 200, json: async () => ({ verified: true, verdict: fullVerdict }) };
    }
    return { ok: true, status: 200, json: async () => ({ verdict: fullVerdict }) };
  };

  const scored = await scoreText('hello', {
    apiKey: 'cr_test_key_not_a_secret',
    baseUrl: 'https://api.example.com',
    fetch,
  });
  assert.equal(scored.score, 82);
  assert.equal(scored.issues[0], 'Hedging missing');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, 'https://api.example.com/api/score');
  assert.equal(calls[0].authorization, 'Bearer cr_test_key_not_a_secret');
  assert.equal(JSON.parse(calls[0].body ?? '{}').responseText, 'hello');

  calls.length = 0;
  const looked = await lookupVerdict('v1', { baseUrl: 'https://api.example.com', fetch, apiKey: 'cr_test_key_not_a_secret' });
  assert.equal(looked.verified, true);
  assert.equal(looked.verdict?.verdictId, 'v1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url, 'https://api.example.com/api/verify/v1');
  assert.equal(calls[0].authorization, undefined);
  assert.equal(calls[0].body, undefined);
});

test('lookupVerdict and scoreText reject an empty 200 without calling the id invalid', async () => {
  const fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  await assert.rejects(() => lookupVerdict('v1', { fetch }), (err: unknown) => {
    assert.match((err as Error).message, /did not return a verification result/);
    assert.doesNotMatch((err as Error).message, /invalid/i);
    return true;
  });
  await assert.rejects(() => scoreText('hello', { apiKey: 'cr_test_key_not_a_secret', fetch }), /did not return a verdict/);
});
