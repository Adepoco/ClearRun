// SPDX-License-Identifier: MIT
// MCP server tests. Fetch is mocked. The closed kernel is absent.
// These tests never send a real API key.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { FetchLike } from '@clearrun/sdk';
import {
  createClearRunServer,
  MISSING_KEY_MESSAGE,
  presentApiResult,
  SERVER_VERSION,
  TOOL_NAMES,
  warnIfApiKeyMissing,
  type ClearRunMcpOptions,
} from '../src/index';

const API_KEY = 'cr_test_key_not_a_secret';

const sampleVerdict = {
  verdictId: 'v1',
  schemaVersion: '1.0.0',
  scoringVersion: 'ck-1.0.0',
  score: 82,
  grade: 'Generally reliable',
  risk: 'low',
  failureCategories: [],
  confidenceInterval: { min: 74, max: 90 },
  summary: 'Confidence matches the reasoning.',
  timestamp: '2026-01-08T00:00:00.000Z',
  signature: 'sig-example',
  signatureKeyId: 'sig-1',
  signatureAlg: 'ed25519',
};

function stubFetch(handler: (url: string, init: { headers?: Record<string, string>; body?: string; method?: string }) => { status: number; body: unknown }): {
  fetch: FetchLike;
  calls: Array<{ url: string; init: { headers?: Record<string, string>; body?: string; method?: string } }>;
} {
  const calls: Array<{ url: string; init: { headers?: Record<string, string>; body?: string; method?: string } }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const { status, body } = handler(url, init ?? {});
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetch, calls };
}

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
}

async function withClient(options: ClearRunMcpOptions, fn: (client: Client) => Promise<void>): Promise<void> {
  const server = createClearRunServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'clearrun-mcp-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test('missing key: score, evaluate, and chat return the key error and do not call the API', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verdict: sampleVerdict } }));
  await withClient({ apiKey: '   ', env: {}, fetch }, async (client) => {
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map((tool) => tool.name).sort(),
      [...TOOL_NAMES].sort()
    );
    for (const tool of listed.tools) {
      assert.match(tool.description ?? '', /not a fact-checker/i);
    }

    const callsFor: Array<[string, Record<string, unknown>]> = [
      ['clearrun_score', { responseText: 'hello' }],
      ['clearrun_evaluate', { responseText: 'hello', prompt: 'question' }],
      ['clearrun_chat', { message: 'hello' }],
    ];
    for (const [name, args] of callsFor) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true);
      const text = textOf(result);
      assert.equal(text, MISSING_KEY_MESSAGE);
      assert.match(text, /https:\/\/api\.clearrun\.net\/account\/keys/);
      assert.match(text, /npx @clearrun\/cli login/);
      assert.match(text, /CLEARRUN_API_KEY/);
      assert.equal(text.includes(API_KEY), false);
      assert.doesNotMatch(text, /forceMock|MockKernelClient|"score"/);
    }
  });
  assert.equal(calls.length, 0);
});

test('missing key: clearrun_verify looks up the id and does not send a key', async () => {
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verified: true, verdict: sampleVerdict } }));
  await withClient({ apiKey: '   ', env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_verify', arguments: { verdictId: 'v1' } });
    assert.notEqual(result.isError, true);
    const body = JSON.parse(textOf(result)) as { verified: boolean; scored: boolean; answered: boolean };
    assert.equal(body.verified, true);
    assert.equal(body.scored, true);
    assert.equal(body.answered, false);
    assert.equal(textOf(result).includes(API_KEY), false);
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'GET');
  assert.match(calls[0].url, /\/api\/verify\/v1$/);
  assert.equal(calls[0].init.headers?.Authorization, undefined);
});

test('401 from the API is returned plainly and the key is not echoed', async () => {
  const logs: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    const { fetch, calls } = stubFetch(() => ({ status: 401, body: { error: 'Unauthorized', code: 'unauthorized' } }));
    await withClient({ env: { CLEARRUN_API_KEY: API_KEY }, fetch }, async (client) => {
      const result = await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } });
      assert.equal(result.isError, true);
      const text = textOf(result);
      assert.match(text, /ClearRun API returned 401: Unauthorized/);
      assert.equal(text.includes(API_KEY), false);
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, 'POST');
    assert.match(calls[0].url, /\/api\/score$/);
    assert.equal(calls[0].init.headers?.Authorization, `Bearer ${API_KEY}`);
    assert.equal(logs.some((line) => line.includes(API_KEY)), false);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
});

test('403 free plan surfaces the API message plainly', async () => {
  const { fetch } = stubFetch(() => ({
    status: 403,
    body: { error: 'API access requires a Pro plan or higher.' },
  }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_evaluate', arguments: { responseText: 'hello' } });
    assert.equal(result.isError, true);
    const text = textOf(result);
    assert.match(text, /API access requires a Pro plan or higher\./);
    assert.equal(text.includes(API_KEY), false);
  });
});

test('success shape returns score, verdict, and scoring version and does not invent a receipt', async () => {
  const { fetch, calls } = stubFetch((url) => {
    if (url.endsWith('/api/chat')) {
      return { status: 200, body: { responseText: 'Paris.', verdict: sampleVerdict } };
    }
    if (url.includes('/api/verify/')) {
      return { status: 200, body: { verified: true, verdict: sampleVerdict } };
    }
    return { status: 200, body: { verdict: sampleVerdict } };
  });

  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const scored = await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'The tower is tall.' } });
    assert.notEqual(scored.isError, true);
    const scoreBody = JSON.parse(textOf(scored)) as Record<string, unknown>;
    assert.equal(scoreBody.score, 82);
    assert.equal(scoreBody.outcome, 'scored');
    assert.equal(scoreBody.scored, true);
    assert.equal(scoreBody.answered, false);
    assert.equal(scoreBody.scoringVersion, 'ck-1.0.0');
    assert.equal((scoreBody.verdict as { verdictId: string }).verdictId, 'v1');
    assert.equal((scoreBody.verdict as { scoringVersion: string }).scoringVersion, 'ck-1.0.0');
    assert.equal(Object.prototype.hasOwnProperty.call(scoreBody, 'receipt'), false);
    assert.equal(textOf(scored).includes(API_KEY), false);
    const structured = (scored as { structuredContent?: Record<string, unknown> }).structuredContent;
    assert.equal(structured?.scoringVersion, 'ck-1.0.0');

    const evaluated = JSON.parse(
      textOf(await client.callTool({
        name: 'clearrun_evaluate',
        arguments: { responseText: 'The tower is tall.', prompt: 'Where is it?' },
      }))
    ) as Record<string, unknown>;
    assert.equal(evaluated.score, 82);
    assert.equal(evaluated.scoringVersion, 'ck-1.0.0');
    assert.equal(Object.prototype.hasOwnProperty.call(evaluated, 'receipt'), false);

    const chat = JSON.parse(
      textOf(await client.callTool({ name: 'clearrun_chat', arguments: { message: 'Capital of France?' } }))
    ) as Record<string, unknown>;
    assert.equal(chat.responseText, 'Paris.');
    assert.equal(chat.answered, true);
    assert.equal(chat.scored, true);
    assert.equal(chat.score, 82);
    assert.equal(chat.scoringVersion, 'ck-1.0.0');
    assert.equal(Object.prototype.hasOwnProperty.call(chat, 'receipt'), false);

    const verified = JSON.parse(
      textOf(await client.callTool({ name: 'clearrun_verify', arguments: { verdictId: 'v1' } }))
    ) as Record<string, unknown>;
    assert.equal(verified.verified, true);
    assert.equal(verified.scored, true);
    assert.equal(verified.answered, false);
    assert.equal(verified.scoringVersion, 'ck-1.0.0');
    assert.equal((verified.verdict as { score: number }).score, 82);
    assert.equal(Object.prototype.hasOwnProperty.call(verified, 'receipt'), false);
  });

  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /\/api\/score$/);
  assert.match(calls[1].url, /\/api\/evaluate$/);
  assert.match(calls[2].url, /\/api\/chat$/);
  assert.match(calls[3].url, /\/api\/verify\/v1$/);
  assert.equal(calls[3].init.headers?.Authorization, undefined);
});

test('presentApiResult does not invent a scoring version or a receipt', () => {
  const verdict = { ...sampleVerdict } as Record<string, unknown>;
  delete verdict.scoringVersion;
  const body = presentApiResult({ verdict });
  assert.equal(body.score, 82);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'scoringVersion'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'receipt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(body.verdict as object, 'scoringVersion'), false);
});

test('clearrun_verify accepts schema 1.1.0 public, paid, and 1.0.0 legacy verdicts', async () => {
  const publicVerdict = {
    verdictId: 'v-public',
    schemaVersion: '1.1.0',
    score: 70,
    grade: 'Generally reliable',
    risk: 'low',
    summary: 'Confidence matches the reasoning.',
    signature: 'sig-public',
    signalsDigest: 'digest-public',
    timestamp: '2026-11-10T00:00:00.000Z',
  };
  const paidVerdict = {
    ...publicVerdict,
    verdictId: 'v-paid',
    componentSignals: [{ name: 'Evidence support', level: 4 }],
    signalsSalt: 'salt-example',
  };
  const legacyVerdict = { ...sampleVerdict, schemaVersion: '1.0.0' };
  for (const [id, verdict] of [
    ['v-public', publicVerdict],
    ['v-paid', paidVerdict],
    ['v-legacy', legacyVerdict],
  ] as const) {
    const { fetch } = stubFetch(() => ({ status: 200, body: { verified: true, verdict } }));
    await withClient({ env: {}, fetch }, async (client) => {
      const result = await client.callTool({ name: 'clearrun_verify', arguments: { verdictId: id } });
      assert.notEqual(result.isError, true, id);
      const body = JSON.parse(textOf(result)) as {
        verified?: boolean;
        scored?: boolean;
        scoringVersion?: string;
        signalsSalt?: string;
        verdict: Record<string, unknown>;
      };
      assert.equal(body.verified, true);
      assert.equal(body.scored, true);
      assert.equal(textOf(result).includes('undefined'), false);
      if (id === 'v-public') {
        assert.equal(Object.prototype.hasOwnProperty.call(body.verdict, 'scoringVersion'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(body.verdict, 'failureCategories'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(body.verdict, 'signalsSalt'), false);
        assert.equal(body.signalsSalt, undefined);
      }
      if (id === 'v-paid') {
        assert.equal(body.verdict.signalsSalt, 'salt-example');
        assert.ok(Array.isArray(body.verdict.componentSignals));
      }
      if (id === 'v-legacy') {
        assert.equal(body.scoringVersion, 'ck-1.0.0');
        assert.equal(body.verdict.scoringVersion, 'ck-1.0.0');
      }
    });
  }
});

test('a free 1.1.0 score without scoringVersion is still a verdict', async () => {
  const verdict = {
    verdictId: 'v-free',
    schemaVersion: '1.1.0',
    score: 70,
    grade: 'Generally reliable',
    risk: 'low',
    summary: 'Confidence matches the reasoning.',
    signalsDigest: 'digest-public',
  };
  const { fetch } = stubFetch(() => ({ status: 200, body: { verdict } }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } });
    assert.notEqual(result.isError, true);
    const body = JSON.parse(textOf(result)) as { outcome: string; scored: boolean; scoringVersion?: string };
    assert.equal(body.outcome, 'scored');
    assert.equal(body.scored, true);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'scoringVersion'), false);
    assert.equal(textOf(result).includes('undefined'), false);
  });
});

const coarse10Verdict = {
  verdictId: 'v-coarse',
  schemaVersion: '1.0.0',
  score: 64,
  grade: 'Generally reliable',
  risk: 'moderate',
  summary: 'Confidence matches the reasoning.',
  timestamp: '2026-11-10T00:00:00.000Z',
  signature: 'sig-coarse',
  signatureKeyId: 'sig-key-1',
  signatureAlg: 'ed25519',
};

const coarseOmitted = [
  'scoringVersion',
  'failureCategories',
  'confidenceInterval',
  'componentSignals',
  'signalsDigest',
] as const;

function assertCoarse10(body: Record<string, unknown>, label: string): void {
  const verdict = body.verdict as Record<string, unknown>;
  assert.equal(body.outcome, 'scored', label);
  assert.equal(body.scored, true, label);
  assert.equal(body.score, 64, label);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'scoringVersion'), false, label);
  assert.equal(verdict.verdictId, coarse10Verdict.verdictId, label);
  assert.equal(verdict.schemaVersion, '1.0.0', label);
  assert.equal(verdict.score, 64, label);
  assert.equal(verdict.grade, coarse10Verdict.grade, label);
  assert.equal(verdict.risk, coarse10Verdict.risk, label);
  assert.equal(verdict.summary, coarse10Verdict.summary, label);
  assert.equal(verdict.timestamp, coarse10Verdict.timestamp, label);
  assert.equal(verdict.signature, coarse10Verdict.signature, label);
  assert.equal(verdict.signatureKeyId, coarse10Verdict.signatureKeyId, label);
  assert.equal(verdict.signatureAlg, coarse10Verdict.signatureAlg, label);
  for (const key of coarseOmitted) {
    assert.equal(Object.prototype.hasOwnProperty.call(verdict, key), false, `${label} ${key}`);
  }
}

test('coarse 1.0.0 public and free score and verify stay verdicts', async () => {
  const { fetch: scoreFetch, calls: scoreCalls } = stubFetch(() => ({
    status: 200,
    body: { verdict: coarse10Verdict },
  }));
  await withClient({ apiKey: API_KEY, env: {}, fetch: scoreFetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } });
    assert.notEqual(result.isError, true);
    const body = JSON.parse(textOf(result)) as Record<string, unknown>;
    assertCoarse10(body, 'score');
    assert.equal(body.answered, false);
    assert.equal(textOf(result).includes('did not return a verdict'), false);
    assert.equal(textOf(result).includes(API_KEY), false);
  });
  assert.equal(scoreCalls.length, 1);
  assert.match(scoreCalls[0].url, /\/api\/score$/);

  const { fetch: verifyFetch, calls: verifyCalls } = stubFetch(() => ({
    status: 200,
    body: { verified: true, verdict: coarse10Verdict },
  }));
  await withClient({ env: {}, fetch: verifyFetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_verify', arguments: { verdictId: 'v-coarse' } });
    assert.notEqual(result.isError, true);
    const body = JSON.parse(textOf(result)) as Record<string, unknown>;
    assertCoarse10(body, 'verify');
    assert.equal(body.verified, true);
    assert.equal(body.answered, false);
    assert.equal(textOf(result).includes('did not return a verdict'), false);
  });
  assert.equal(verifyCalls.length, 1);
  assert.equal(verifyCalls[0].init.method, 'GET');
  assert.match(verifyCalls[0].url, /\/api\/verify\/v-coarse$/);
  assert.equal(verifyCalls[0].init.headers?.Authorization, undefined);
});

test('chat accepts a schema 1.1.0 public verdict and a coarse 1.0.0 verdict', async () => {
  const public11 = {
    verdictId: 'v-public',
    schemaVersion: '1.1.0',
    score: 70,
    grade: 'Generally reliable',
    risk: 'low',
    summary: 'Confidence matches the reasoning.',
    signature: 'sig-public',
    signalsDigest: 'digest-public',
    timestamp: '2026-11-10T00:00:00.000Z',
  };
  const cases: Array<[string, Record<string, unknown>]> = [
    ['1.1.0 public', public11],
    ['coarse 1.0.0', coarse10Verdict],
  ];
  for (const [label, verdict] of cases) {
    const { fetch } = stubFetch(() => ({ status: 200, body: { responseText: 'Paris.', verdict } }));
    await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
      const result = await client.callTool({ name: 'clearrun_chat', arguments: { message: 'Capital?' } });
      assert.notEqual(result.isError, true, label);
      const body = JSON.parse(textOf(result)) as {
        outcome: string;
        answered: boolean;
        scored: boolean;
        responseText: string;
        error?: string;
      };
      assert.equal(body.outcome, 'scored', label);
      assert.equal(body.answered, true, label);
      assert.equal(body.scored, true, label);
      assert.equal(body.responseText, 'Paris.', label);
      assert.equal(body.error, undefined, label);
      assert.equal(textOf(result).includes('no verdict'), false, label);
      if (label === 'coarse 1.0.0') assertCoarse10(body, label);
    });
  }
});

test('a 200 body with nothing to read is a tool error', async () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['clearrun_score', { responseText: 'hello' }, 'did not return a verdict'],
    ['clearrun_evaluate', { responseText: 'hello' }, 'did not return a verdict'],
    ['clearrun_chat', { message: 'hello' }, 'did not return an answer or a verdict'],
    ['clearrun_verify', { verdictId: 'v1' }, 'did not return a verification result'],
  ];
  for (const [name, args, message] of cases) {
    const { fetch } = stubFetch(() => ({ status: 200, body: {} }));
    await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, name);
      const body = JSON.parse(textOf(result)) as { outcome: string; answered: boolean; scored: boolean; error: string };
      assert.equal(body.outcome, 'failed', name);
      assert.equal(body.answered, false, name);
      assert.equal(body.scored, false, name);
      assert.match(body.error, new RegExp(message), name);
      assert.doesNotMatch(body.error, /invalid/i, name);
      assert.equal(textOf(result).includes(API_KEY), false);
    });
  }
});

test('chat with an answer and no verdict is answered, not scored', async () => {
  const { fetch } = stubFetch(() => ({ status: 200, body: { response: 'Paris.' } }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_chat', arguments: { message: 'Capital?' } });
    assert.equal(result.isError, true);
    const body = JSON.parse(textOf(result)) as {
      outcome: string;
      answered: boolean;
      scored: boolean;
      responseText: string;
    };
    assert.equal(body.outcome, 'answered');
    assert.equal(body.answered, true);
    assert.equal(body.scored, false);
    assert.equal(body.responseText, 'Paris.');
  });
});

test('chat with a legacy response field and a verdict is answered and scored', async () => {
  const { fetch } = stubFetch(() => ({ status: 200, body: { response: 'Paris.', verdict: sampleVerdict } }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_chat', arguments: { message: 'Capital?' } });
    assert.notEqual(result.isError, true);
    const body = JSON.parse(textOf(result)) as { answered: boolean; scored: boolean; responseText: string; score: number };
    assert.equal(body.answered, true);
    assert.equal(body.scored, true);
    assert.equal(body.responseText, 'Paris.');
    assert.equal(body.score, 82);
  });
});

test('chat with a verdict and no answer is scored, not answered', async () => {
  const { fetch } = stubFetch(() => ({ status: 200, body: { verdict: sampleVerdict } }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_chat', arguments: { message: 'Capital?' } });
    assert.equal(result.isError, true);
    const body = JSON.parse(textOf(result)) as { outcome: string; answered: boolean; scored: boolean; score: number };
    assert.equal(body.outcome, 'scored');
    assert.equal(body.answered, false);
    assert.equal(body.scored, true);
    assert.equal(body.score, 82);
  });
});

test('verify of an unknown id is readable and is not a transport error', async () => {
  const { fetch } = stubFetch(() => ({ status: 200, body: { verified: false } }));
  await withClient({ env: {}, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_verify', arguments: { verdictId: 'missing' } });
    assert.notEqual(result.isError, true);
    const body = JSON.parse(textOf(result)) as { verified: boolean; scored: boolean; error: string };
    assert.equal(body.verified, false);
    assert.equal(body.scored, false);
    assert.match(body.error, /did not verify/);
    assert.doesNotMatch(body.error, /invalid/i);
  });
});

test('a receipt on the API payload is passed through and not invented otherwise', async () => {
  const receipt = { id: 'rcpt-1', verdictId: 'v1' };
  const { fetch } = stubFetch(() => ({ status: 200, body: { verdict: sampleVerdict, receipt } }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const body = JSON.parse(
      textOf(await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } }))
    ) as { receipt?: { id: string }; scoringVersion?: string };
    assert.equal(body.scoringVersion, 'ck-1.0.0');
    assert.deepEqual(body.receipt, receipt);
  });
});

test('config file supplies the key when the environment does not, and the environment wins', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'clearrun-mcp-'));
  const configPath = join(dir, 'config.json');
  const fileKey = 'cr_file_key_not_a_secret';
  writeFileSync(configPath, JSON.stringify({ apiKey: fileKey }));
  const { fetch, calls } = stubFetch(() => ({ status: 200, body: { verdict: sampleVerdict } }));
  await withClient({ env: {}, configPath, fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } });
    assert.notEqual(result.isError, true);
    assert.equal(textOf(result).includes(fileKey), false);
  });
  assert.equal(calls[0].init.headers?.Authorization, `Bearer ${fileKey}`);

  const envKey = 'cr_env_key_not_a_secret';
  const second = stubFetch(() => ({ status: 200, body: { verdict: sampleVerdict } }));
  await withClient({ env: { CLEARRUN_API_KEY: envKey }, configPath, fetch: second.fetch }, async (client) => {
    const result = await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } });
    assert.equal(textOf(result).includes(envKey), false);
    assert.equal(textOf(result).includes(fileKey), false);
  });
  assert.equal(second.calls[0].init.headers?.Authorization, `Bearer ${envKey}`);
});

test('startup logs the missing-key message and does not log a configured key', () => {
  const home = mkdtempSync(join(tmpdir(), 'clearrun-mcp-home-'));
  const lines: string[] = [];
  warnIfApiKeyMissing({ HOME: home }, (line) => lines.push(line));
  assert.deepEqual(lines, [MISSING_KEY_MESSAGE]);
  assert.match(lines[0], /npx @clearrun\/cli login/);
  assert.equal(lines[0].includes('cr_file_key_not_a_secret'), false);

  const quiet: string[] = [];
  warnIfApiKeyMissing({ CLEARRUN_API_KEY: 'cr_env_key_not_a_secret', HOME: home }, (line) => quiet.push(line));
  assert.deepEqual(quiet, []);

  const configHome = mkdtempSync(join(tmpdir(), 'clearrun-mcp-home-'));
  const configPath = join(configHome, '.config', 'clearrun', 'config.json');
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ apiKey: 'cr_file_key_not_a_secret' }));
  const fromFile: string[] = [];
  warnIfApiKeyMissing({ HOME: configHome }, (line) => fromFile.push(line));
  assert.deepEqual(fromFile, []);
});

test('server.json does not require a key for verify, and still names the scoring tools', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'server.json'), 'utf8'));
  const variable = manifest.packages[0].environmentVariables[0];
  assert.equal(variable.name, 'CLEARRUN_API_KEY');
  assert.equal(variable.isRequired, false);
  assert.equal(variable.isSecret, true);
  assert.match(variable.description, /clearrun_score/);
  assert.match(variable.description, /clearrun_evaluate/);
  assert.match(variable.description, /clearrun_chat/);
  assert.match(variable.description, /clearrun_verify/);
  assert.match(variable.description, /does not read/);
  assert.equal(manifest.name, 'io.github.adepoco/clearrun-mcp');
  assert.equal(manifest.version, '1.2.0');
  assert.equal(manifest.packages[0].version, '1.2.0');
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
    version: string;
    mcpName: string;
    dependencies: Record<string, string>;
  };
  assert.equal(pkg.version, '1.2.0');
  assert.equal(pkg.mcpName, 'io.github.adepoco/clearrun-mcp');
  assert.equal(pkg.dependencies['@clearrun/sdk'], '^1.2.0');
  assert.equal(pkg.dependencies['@clearrun/core-types'], '^1.2.0');
  assert.equal(SERVER_VERSION, pkg.version);
});

test('package copy does not use an em dash', () => {
  const readme = readFileSync(join(__dirname, '..', 'README.md'), 'utf8');
  const rootReadme = readFileSync(join(__dirname, '..', '..', '..', 'README.md'), 'utf8');
  assert.equal(readme.includes('\u2014'), false);
  assert.equal(rootReadme.includes('\u2014'), false);
  assert.match(readme, /not a fact-checker/i);
  assert.match(readme, /CLEARRUN_API_KEY/);
  assert.match(readme, /YOUR_CLEARRUN_API_KEY/);
  assert.match(readme, /clearrun_score/);
  assert.match(readme, /clearrun_evaluate/);
  assert.match(readme, /clearrun_chat/);
  assert.match(readme, /clearrun_verify/);
});
