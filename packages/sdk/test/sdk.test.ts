// SPDX-License-Identifier: MIT
// Public SDK tests: MockKernelClient (standalone), HostedApiClient (stubbed
// fetch), factory routing, and boundary-type conformance. Runs with the closed
// kernel (CV-ClearRun-core) ABSENT.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createKernelClient,
  MockKernelClient,
  HostedApiClient,
  HostedApiError,
  MissingApiKeyError,
  type FetchLike,
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
  assert.equal(v.schemaVersion, '1.0.0');
  assert.equal(typeof v.scoringVersion, 'string');
  assert.ok(v.score === null || (typeof v.score === 'number' && v.score >= 0 && v.score <= 100));
  assert.ok(GRADES.includes(v.grade));
  assert.ok(RISKS.includes(v.risk));
  assert.ok(Array.isArray(v.failureCategories));
  assert.equal(typeof v.summary, 'string');
  assert.equal(typeof v.timestamp, 'string');
}

// ── MockKernelClient (standalone) ────────────────────────────────────────────

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

function stubFetch(handler: (url: string, init: any) => { status: number; body: unknown }): {
  fetch: FetchLike;
  calls: Array<{ url: string; init: any }>;
} {
  const calls: Array<{ url: string; init: any }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetch, calls };
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
    return true;
  });
});

// ── Factory routing ──────────────────────────────────────────────────────────

test('createKernelClient throws MissingApiKeyError without a key and without mock opt-in', () => {
  assert.throws(
    () => createKernelClient({ env: { HOME: `/tmp/clearrun-sdk-missing-${process.pid}-${Date.now()}` } }),
    (err: unknown) => {
      assert.ok(err instanceof MissingApiKeyError);
      assert.equal((err as MissingApiKeyError).name, 'MissingApiKeyError');
      assert.equal((err as MissingApiKeyError).signupUrl, 'https://api.clearrun.net/account/keys');
      assert.match((err as Error).message, /https:\/\/api\.clearrun\.net\/account\/keys/);
      assert.match((err as Error).message, /npx @clearrun\/cli login/);
      assert.match((err as Error).message, /CLEARRUN_API_KEY/);
      assert.doesNotMatch((err as Error).message, /cr_test_key_not_a_secret/);
      return true;
    }
  );
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
