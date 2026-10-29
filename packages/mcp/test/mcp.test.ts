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

test('missing key: every tool returns a Pro-plan error and does not call the API', async () => {
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
      ['clearrun_verify', { verdictId: 'v1' }],
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
    assert.equal(chat.score, 82);
    assert.equal(chat.scoringVersion, 'ck-1.0.0');
    assert.equal(Object.prototype.hasOwnProperty.call(chat, 'receipt'), false);

    const verified = JSON.parse(
      textOf(await client.callTool({ name: 'clearrun_verify', arguments: { verdictId: 'v1' } }))
    ) as Record<string, unknown>;
    assert.equal(verified.verified, true);
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

test('a missing scoring version or receipt is left out', async () => {
  const verdict = { ...sampleVerdict } as Record<string, unknown>;
  delete verdict.scoringVersion;
  const { fetch } = stubFetch(() => ({ status: 200, body: { verdict } }));
  await withClient({ apiKey: API_KEY, env: {}, fetch }, async (client) => {
    const body = JSON.parse(
      textOf(await client.callTool({ name: 'clearrun_score', arguments: { responseText: 'hello' } }))
    ) as Record<string, unknown>;
    assert.equal(body.score, 82);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'scoringVersion'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'receipt'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body.verdict as object, 'scoringVersion'), false);
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
