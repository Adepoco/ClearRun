// SPDX-License-Identifier: MIT
// Public SDK tests: MockKernelClient (standalone), HostedApiClient (stubbed
// fetch), factory routing, and boundary-type conformance. Runs with the closed
// kernel (CV-ClearRun-core) ABSENT.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createKernelClient,
  createVerifyClient,
  isVerdict,
  MockKernelClient,
  HostedApiClient,
  HostedApiError,
  MissingApiKeyError,
  MISSING_API_KEY_MESSAGE,
  type FetchLike,
  type Receipt,
  type Verdict,
  type HonestyKernelClient,
} from '../src/index';

const GRADES = [
  'Well supported',
  'Generally reliable',
  'Verify before use',
  'High risk',
  'Likely misleading',
  'Not configured',
];
const RISKS = ['low', 'moderate', 'elevated', 'high'];

function assertValidVerdict(v: Verdict) {
  assert.equal(typeof v.verdictId, 'string');
  assert.ok(['1.0.0', '1.1.0', '1.2.0'].includes(String(v.schemaVersion)), String(v.schemaVersion));
  assert.equal(typeof v.scoringVersion, 'string');
  assert.ok(v.score === null || (typeof v.score === 'number' && v.score >= 0 && v.score <= 100));
  assert.ok(GRADES.includes(v.grade));
  assert.ok(RISKS.includes(v.risk));
  assert.ok(v.failureCategories === undefined || Array.isArray(v.failureCategories));
  assert.equal(typeof v.summary, 'string');
  assert.equal(typeof v.timestamp, 'string');
}

// ── MockKernelClient (standalone) ────────────────────────────────────────────

const public11 = {
  verdictId: 'v-public',
  schemaVersion: '1.1.0',
  score: 70,
  grade: 'Generally reliable' as const,
  risk: 'low' as const,
  summary: 'Confidence matches the reasoning.',
  signature: 'sig-public',
  signalsDigest: 'digest-public',
  inputHash: 'hash-in',
  outputHash: 'hash-out',
  verdictHash: 'hash-verdict',
  timestamp: '2026-11-10T00:00:00.000Z',
};

test('isVerdict accepts a 1.1.0 public verify, a 1.1.0 paid verify, and a 1.0.0 legacy verdict', () => {
  assert.equal(isVerdict(public11), true);
  assert.equal(Object.prototype.hasOwnProperty.call(public11, 'scoringVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(public11, 'failureCategories'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(public11, 'signalsSalt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(public11, 'confidenceInterval'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(public11, 'componentSignals'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(public11, 'issues'), false);

  const paid = {
    ...public11,
    componentSignals: [{ name: 'Evidence support', level: 4, note: 'paid owner' }],
    signalsSalt: 'salt-example',
  };
  assert.equal(isVerdict(paid), true);
  assert.equal(paid.signalsSalt, 'salt-example');
  assert.equal(paid.componentSignals[0].name, 'Evidence support');

  const legacy = {
    verdictId: 'v-legacy',
    schemaVersion: '1.0.0',
    scoringVersion: 'ck-1.0.0',
    score: 82,
    grade: 'Generally reliable' as const,
    risk: 'low' as const,
    failureCategories: [] as string[],
    confidenceInterval: { min: 74, max: 90 },
    summary: 'Confidence matches the reasoning.',
    issues: ['Hedging missing'],
    timestamp: '2026-01-08T00:00:00.000Z',
    signature: 'sig-legacy',
  };
  assert.equal(isVerdict(legacy), true);
  assert.equal(legacy.scoringVersion, 'ck-1.0.0');
  assert.deepEqual(legacy.failureCategories, []);
  assert.equal(Object.prototype.hasOwnProperty.call(legacy, 'signalsSalt'), false);
  assert.equal(isVerdict({ score: 1 }), false);
});

test('MockKernelClient.evaluate returns a schema-valid Verdict', async () => {
  const client = new MockKernelClient();
  const { verdict } = await client.evaluate({ responseText: 'hello world' });
  assertValidVerdict(verdict);
});

test('MockKernelClient.score is deterministic per input', async () => {
  const client = new MockKernelClient();
  const a = (await client.score({ responseText: 'same text' })).verdict.score;
  const b = (await client.score({ responseText: 'same text' })).verdict.score;
  assert.equal(a, b);
});

test('MockKernelClient.chat returns response + verdict', async () => {
  const client = new MockKernelClient({ chatResponse: 'canned reply' });
  const res = await client.chat({ message: 'hi' });
  assert.equal(res.responseText, 'canned reply');
  assertValidVerdict(res.verdict);
});

test('MockKernelClient.verify round-trips a produced verdict', async () => {
  const client = new MockKernelClient();
  const { verdict } = await client.evaluate({ responseText: 'x' });
  const res = await client.verify({ verdictId: verdict.verdictId });
  assert.equal(res.verified, true);
  const missing = await client.verify({ verdictId: 'nope' });
  assert.equal(missing.verified, false);
});

// ── HostedApiClient (stubbed fetch) ──────────────────────────────────────────

function stubFetch(
  handler: (
    url: string,
    init: any
  ) => { status: number; body: unknown; headers?: { get(name: string): string | null } }
): {
  fetch: FetchLike;
  calls: Array<{ url: string; init: any }>;
} {
  const calls: Array<{ url: string; init: any }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const { status, body, headers } = handler(url, init);
    return { ok: status >= 200 && status < 300, status, headers, json: async () => body };
  };
  return { fetch, calls };
}

function header(map: Record<string, string>): { get(name: string): string | null } {
  return {
    get(name: string) {
      const found = Object.keys(map).find((key) => key.toLowerCase() === name.toLowerCase());
      return found ? map[found] : null;
    },
  };
}

const sampleVerdict: Verdict = {
  verdictId: 'v1',
  schemaVersion: '1.0.0',
  scoringVersion: 'ck-1.0.0',
  score: 82,
  grade: 'Generally reliable',
  risk: 'low',
  failureCategories: [],
  confidenceInterval: { min: 74, max: 90 },
  summary: 'Well matched.',
  timestamp: new Date().toISOString(),
};

test('HostedApiClient.evaluate POSTs to /api/evaluate with Bearer auth', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verdict: sampleVerdict } }));
  const client = new HostedApiClient({ baseUrl: 'https://api.example.com', apiKey: 'sk_test' }, { fetch });
  const { verdict } = await client.evaluate({ responseText: 'hi' });
  assert.equal(verdict.verdictId, 'v1');
  assert.equal(calls[0].url, 'https://api.example.com/api/evaluate');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Authorization'], 'Bearer sk_test');
});

test('HostedApiClient.verify GETs /api/verify/{id} without auth', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verified: true, verdict: sampleVerdict } }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  const res = await client.verify({ verdictId: 'v1' });
  assert.equal(res.verified, true);
  assert.equal(calls[0].url, 'https://api.clearrun.net/api/verify/v1');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers['Authorization'], undefined);
});

test('HostedApiClient.chat returns responseText when the API sends it', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { responseText: 'Paris.', verdict: sampleVerdict } }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  const res = await client.chat({ message: 'Capital of France?' });
  assert.equal(res.responseText, 'Paris.');
  assert.equal(res.verdict.verdictId, 'v1');
  assert.equal(calls[0].url, 'https://api.clearrun.net/api/chat');
  assert.equal(JSON.parse(calls[0].init.body).message, 'Capital of France?');
});

test('HostedApiClient.chat maps the legacy response field to responseText', async () => {
  // 0.1.0 bug: the live API returned { response, verdict } and chat() left responseText undefined.
  const { fetch } = stubFetch(() => ({ status: 200, body: { response: 'Paris.', verdict: sampleVerdict } }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  const res = await client.chat({ message: 'Capital of France?' });
  assert.equal(res.responseText, 'Paris.');
  assertValidVerdict(res.verdict);
});

test('HostedApiClient.chat prefers responseText when both fields are present', async () => {
  const { fetch } = stubFetch(() => ({ status: 200, body: { responseText: 'new', response: 'old', verdict: sampleVerdict } }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  assert.equal((await client.chat({ message: 'x' })).responseText, 'new');
});

test('HostedApiClient throws HostedApiError on non-2xx', async () => {
  const { fetch } = stubFetch(() => ({ status: 401, body: { error: 'bad key', code: 'unauthorized' } }));
  const client = new HostedApiClient({ apiKey: 'bad' }, { fetch });
  await assert.rejects(() => client.score({ responseText: 'x' }), (err: unknown) => {
    assert.ok(err instanceof HostedApiError);
    assert.equal((err as HostedApiError).status, 401);
    assert.equal((err as HostedApiError).code, 'unauthorized');
    assert.equal((err as HostedApiError).message, 'bad key');
    assert.equal((err as HostedApiError).retryAfter, undefined);
    assert.equal((err as HostedApiError).creditsNeeded, undefined);
    assert.equal((err as HostedApiError).currentBalance, undefined);
    return true;
  });
});

test('HostedApiError exposes retryAfter seconds on 429 from the body or Retry-After', async () => {
  const fromBody = stubFetch(() => ({
    status: 429,
    body: { error: 'Rate limit exceeded', code: 'RATE_LIMITED', retryAfter: 60, details: { bucket: 'score' } },
    headers: header({ 'Retry-After': '15' }),
  }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch: fromBody.fetch });
  await assert.rejects(() => client.score({ responseText: 'x' }), (err: unknown) => {
    assert.ok(err instanceof HostedApiError);
    const hosted = err as HostedApiError;
    assert.equal(hosted.status, 429);
    assert.equal(hosted.code, 'RATE_LIMITED');
    assert.equal(hosted.message, 'Rate limit exceeded');
    assert.deepEqual(hosted.details, { bucket: 'score' });
    assert.equal(hosted.retryAfter, 60);
    assert.equal(hosted.creditsNeeded, undefined);
    return true;
  });

  const fromHeader = stubFetch(() => ({
    status: 429,
    body: { error: 'Rate limit exceeded' },
    headers: header({ 'Retry-After': '45' }),
  }));
  const headerClient = new HostedApiClient({ apiKey: 'sk_test' }, { fetch: fromHeader.fetch });
  await assert.rejects(() => headerClient.evaluate({ responseText: 'x' }), (err: unknown) => {
    assert.ok(err instanceof HostedApiError);
    assert.equal((err as HostedApiError).retryAfter, 45);
    return true;
  });

  const future = new Date(Date.now() + 90_000).toUTCString();
  const fromDate = stubFetch(() => ({
    status: 429,
    body: { error: 'Rate limit exceeded' },
    headers: header({ 'Retry-After': future }),
  }));
  const dateClient = new HostedApiClient({ apiKey: 'sk_test' }, { fetch: fromDate.fetch });
  await assert.rejects(() => dateClient.chat({ message: 'x' }), (err: unknown) => {
    assert.ok(err instanceof HostedApiError);
    const seconds = (err as HostedApiError).retryAfter ?? -1;
    assert.ok(seconds >= 89 && seconds <= 90);
    return true;
  });
});

test('HostedApiError exposes creditsNeeded and currentBalance on 402', async () => {
  const { fetch } = stubFetch(() => ({
    status: 402,
    body: { error: 'Insufficient credits', creditsNeeded: 3, currentBalance: 0 },
    headers: header({ 'Retry-After': '10' }),
  }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  await assert.rejects(() => client.score({ responseText: 'x' }), (err: unknown) => {
    assert.ok(err instanceof HostedApiError);
    const hosted = err as HostedApiError;
    assert.equal(hosted.status, 402);
    assert.equal(hosted.message, 'Insufficient credits');
    assert.equal(hosted.creditsNeeded, 3);
    assert.equal(hosted.currentBalance, 0);
    assert.equal(hosted.retryAfter, undefined);
    return true;
  });
});

test('CONTENT_BLOCKED is carried as code and message Content blocked', async () => {
  const types = readFileSync(join(__dirname, '../../core-types/src/index.ts'), 'utf8');
  assert.equal(/export type \w*ErrorCode/.test(types), false);
  assert.match(types, /CONTENT_BLOCKED/);
  assert.match(types, /Content blocked/);

  const { fetch } = stubFetch(() => ({
    status: 400,
    body: { error: 'Content blocked', code: 'CONTENT_BLOCKED' },
  }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  await assert.rejects(() => client.evaluate({ responseText: 'x' }), (err: unknown) => {
    assert.ok(err instanceof HostedApiError);
    assert.equal((err as HostedApiError).status, 400);
    assert.equal((err as HostedApiError).code, 'CONTENT_BLOCKED');
    assert.equal((err as HostedApiError).message, 'Content blocked');
    return true;
  });
});

const sampleReceipt: Receipt = {
  receiptId: 'rcpt-1',
  verdictId: 'v1',
  workspaceId: 'ws-1',
  inputHash: 'in',
  outputHash: 'out',
  verdictHash: 'vh',
  timestamp: '2026-11-10T00:00:00.000Z',
  keyId: 'key-1',
  alg: 'Ed25519',
  prevHash: 'prev',
  receiptHash: 'hash',
  signature: 'sig',
  encKeyId: 'enc',
  status: 'stored',
};

test('evaluate and score keep receipt, and chat sends context', async () => {
  const { fetch, calls } = stubFetch(() => ({
    status: 200,
    body: { verdict: sampleVerdict, receipt: sampleReceipt, responseText: 'Paris.' },
  }));
  const client = new HostedApiClient({ apiKey: 'sk_test' }, { fetch });
  const evaluated = await client.evaluate({ responseText: 'hi' });
  assert.equal(evaluated.receipt?.receiptId, 'rcpt-1');
  assert.equal(evaluated.receipt?.status, 'stored');
  const scored = await client.score({ responseText: 'hi' });
  assert.equal(scored.receipt?.verdictId, 'v1');
  const context = [{ role: 'user', content: 'Earlier turn.' }];
  const chat = await client.chat({ message: 'Capital of France?', context });
  assert.equal(chat.responseText, 'Paris.');
  assert.deepEqual(JSON.parse(calls[2].init.body).context, context);
});

// ── Factory routing ──────────────────────────────────────────────────────────

test('createVerifyClient looks up a verdict without an API key and does not score', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verified: true, verdict: sampleVerdict } }));
  const client = createVerifyClient({ baseUrl: 'https://api.example.com', deps: { fetch } });
  const res = await client.verify({ verdictId: 'v1' });
  assert.equal(res.verified, true);
  assert.equal(calls[0].url, 'https://api.example.com/api/verify/v1');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(calls[0].init.body, undefined);
  assert.equal('score' in client, false);
});

test('a keyless hosted client refuses to score and still verifies', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verified: true, verdict: sampleVerdict } }));
  const client = new HostedApiClient({ apiKey: '  ' }, { fetch });
  let caught: unknown;
  try {
    await client.score({ responseText: 'x' });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof MissingApiKeyError);
  assert.match((caught as Error).message, /https:\/\/api\.clearrun\.net\/account\/keys/);
  assert.match((caught as Error).message, /npx @clearrun\/cli login/);
  assert.equal((caught as Error).message.toLowerCase().includes('invalid'), false);
  assert.equal(calls.length, 0);
  const looked = await client.verify({ verdictId: 'v1' });
  assert.equal(looked.verified, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/verify\/v1$/);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('createKernelClient defers MissingApiKeyError to the first scoring call', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verified: true, verdict: sampleVerdict } }));
  const client = createKernelClient({
    env: { HOME: `/tmp/clearrun-sdk-missing-${process.pid}-${Date.now()}` },
    deps: { fetch },
  });
  assert.ok(client instanceof HostedApiClient);
  for (const call of [
    () => client.score({ responseText: 'x' }),
    () => client.evaluate({ responseText: 'x' }),
    () => client.chat({ message: 'x' }),
  ]) {
    await assert.rejects(call, (err: unknown) => {
      assert.ok(err instanceof MissingApiKeyError);
      assert.equal((err as MissingApiKeyError).name, 'MissingApiKeyError');
      assert.equal((err as MissingApiKeyError).signupUrl, 'https://api.clearrun.net/account/keys');
      assert.equal((err as Error).message, MISSING_API_KEY_MESSAGE);
      assert.match((err as Error).message, /https:\/\/api\.clearrun\.net\/account\/keys/);
      assert.match((err as Error).message, /npx @clearrun\/cli login/);
      assert.match((err as Error).message, /CLEARRUN_API_KEY/);
      assert.doesNotMatch((err as Error).message, /cr_test_key_not_a_secret/);
      return true;
    });
  }
  assert.equal(calls.length, 0);
  const looked = await client.verify({ verdictId: 'v1' });
  assert.equal(looked.verified, true);
  assert.equal(calls.length, 1);
});

test('mock mode still runs without an API key', async () => {
  const client = createKernelClient({ forceMock: true });
  const scored = await client.score({ responseText: 'local only' });
  assertValidVerdict(scored.verdict);
  const opted = createKernelClient({ mock: {} });
  assert.ok(opted instanceof MockKernelClient);
  assertValidVerdict((await opted.evaluate({ responseText: 'local only' })).verdict);
});

test('sdk package is 1.2.0 and does not claim browser use', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  assert.equal(pkg.version, '1.2.0');
  assert.equal(pkg.dependencies['@clearrun/core-types'], '^1.2.0');
  const typesPkg = JSON.parse(readFileSync(join(__dirname, '../../core-types/package.json'), 'utf8'));
  assert.equal(typesPkg.version, '1.2.0');
  const readme = readFileSync(join(__dirname, '../README.md'), 'utf8');
  const client = readFileSync(join(__dirname, '../src/hosted-client.ts'), 'utf8');
  assert.equal(readme.includes('\u2014'), false);
  assert.equal(client.includes('browsers'), false);
  assert.match(readme, /server or a backend proxy/);
  assert.match(readme, /no CORS headers/);
  assert.match(client, /server or a backend proxy/);
  assert.match(client, /no CORS headers/);
});

test('createKernelClient returns Hosted with apiKey', () => {
  const hosted: HonestyKernelClient = createKernelClient({
    hosted: { apiKey: 'test-api-key', baseUrl: 'https://api.example.com' },
    deps: { fetch: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as FetchLike },
  });
  assert.ok(hosted instanceof HostedApiClient);
});

test('createKernelClient forceMock overrides hosted config', () => {
  const client = createKernelClient({ hosted: { apiKey: 'test-api-key' }, forceMock: true });
  assert.ok(client instanceof MockKernelClient);
});

test('createKernelClient mock options are an explicit opt-in', () => {
  const client = createKernelClient({ mock: { chatResponse: 'opt-in' } });
  assert.ok(client instanceof MockKernelClient);
});
