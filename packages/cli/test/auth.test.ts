// SPDX-License-Identifier: MIT
// login, logout, whoami, key order, and the one-time hint.
// Browser and network are stubbed. No real key is used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { HELP, run } from '../src/cli';
import type { PublicVerdict, VerifyOptions } from '../src/verify';

const SECRET = 'cr_test_key_not_a_secret';

function verdict(): PublicVerdict {
  return {
    score: 80,
    grade: 'Generally reliable',
    risk: 'low',
    issues: [],
    summary: 'Summary for 80.',
    verdictId: 'v-80',
    timestamp: '2026-10-29T00:00:00.000Z',
  };
}

function setup(env: Record<string, string | undefined> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'clearrun-cli-'));
  const home = mkdtempSync(join(tmpdir(), 'clearrun-home-'));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls: Array<{ text: string; options?: VerifyOptions }> = [];
  const opened: string[] = [];
  const fetched: string[] = [];
  let pasted = SECRET;
  const deps = {
    cwd,
    env: { HOME: home, ...env },
    stdout: (line: string) => stdout.push(line),
    stderr: (line: string) => stderr.push(line),
    openUrl: (url: string) => {
      opened.push(url);
    },
    readLine: async (prompt: string) => {
      stdout.push(prompt);
      return pasted;
    },
    fetch: async (url: string) => {
      fetched.push(url);
      throw new Error('network should not be called');
    },
    verify: async (text: string, options?: VerifyOptions) => {
      calls.push({ text, options });
      return verdict();
    },
  };
  const configPath = join(home, '.config', 'clearrun', 'config.json');
  return {
    deps,
    cwd,
    home,
    configPath,
    opened,
    fetched,
    calls,
    setPaste: (value: string) => {
      pasted = value;
    },
    out: () => stdout.join('\n'),
    err: () => stderr.join('\n'),
    text: () => [...stdout, ...stderr].join('\n'),
    clear() {
      stdout.length = 0;
      stderr.length = 0;
    },
  };
}

test('help lists login, logout, and whoami and has no em dash', () => {
  for (const command of ['login', 'logout', 'whoami']) {
    assert.match(HELP, new RegExp(`clearrun ${command}`));
  }
  assert.equal(HELP.includes('\u2014'), false);
  assert.match(HELP, /CLEARRUN_API_KEY/);
  assert.match(HELP, /npx @clearrun\/cli login/);
});

test('login opens the keys page, saves a mode 0600 config, and does not call the network', async () => {
  const h = setup();
  assert.equal(await run(['login'], h.deps), 0);
  assert.deepEqual(h.opened, ['https://api.clearrun.net/account/keys']);
  assert.deepEqual(h.fetched, []);
  assert.equal(h.calls.length, 0);
  assert.match(h.out(), /https:\/\/api\.clearrun\.net\/account\/keys/);
  assert.match(h.out(), /Key: cr_t\.\.\.cret/);
  assert.equal(h.text().includes(SECRET), false);

  const saved = JSON.parse(readFileSync(h.configPath, 'utf8')) as { apiKey?: string; hintShown?: boolean };
  assert.equal(saved.apiKey, SECRET);
  assert.equal(saved.hintShown, true);
  assert.equal(statSync(h.configPath).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(h.configPath)).mode & 0o777, 0o700);
});

test('login refuses an empty paste and does not write a key', async () => {
  const h = setup();
  h.setPaste('   ');
  assert.equal(await run(['login'], h.deps), 1);
  assert.match(h.err(), /No API key was entered/);
  assert.equal(existsSync(h.configPath), false);
  assert.deepEqual(h.fetched, []);
});

test('logout removes the saved key and whoami masks whatever remains', async () => {
  const h = setup();
  assert.equal(await run(['login'], h.deps), 0);
  h.clear();
  assert.equal(await run(['whoami'], h.deps), 0);
  assert.match(h.out(), /Key: cr_t\.\.\.cret/);
  assert.match(h.out(), /Source: .*config\.json$/m);
  assert.equal(h.text().includes(SECRET), false);

  h.clear();
  assert.equal(await run(['logout'], h.deps), 0);
  assert.match(h.out(), /Removed the saved ClearRun API key/);
  assert.equal(h.text().includes(SECRET), false);
  const saved = JSON.parse(readFileSync(h.configPath, 'utf8')) as { apiKey?: string };
  assert.equal(saved.apiKey, undefined);
  assert.equal(statSync(h.configPath).mode & 0o777, 0o600);

  h.clear();
  assert.equal(await run(['whoami'], h.deps), 1);
  assert.match(h.err(), /https:\/\/api\.clearrun\.net\/account\/keys/);
  assert.match(h.err(), /npx @clearrun\/cli login/);
  assert.equal(h.text().includes(SECRET), false);
});

test('logout tells you when CLEARRUN_API_KEY is still set, without printing it', async () => {
  const h = setup({ CLEARRUN_API_KEY: 'cr_env_key_not_a_secret' });
  assert.equal(await run(['logout'], h.deps), 0);
  assert.match(h.out(), /CLEARRUN_API_KEY is set in this shell/);
  assert.equal(h.text().includes('cr_env_key_not_a_secret'), false);
});

test('whoami and verify resolve flag, then env, then user config, then project config', async () => {
  const h = setup();
  writeFileSync(join(h.cwd, 'clearrun.config.json'), JSON.stringify({ apiKey: 'cr_proj_key_not_a_secret' }));
  mkdirSync(dirname(h.configPath), { recursive: true });
  writeFileSync(h.configPath, JSON.stringify({ apiKey: 'cr_file_key_not_a_secret' }), { mode: 0o600 });

  assert.equal(await run(['whoami'], h.deps), 0);
  assert.match(h.out(), /Key: cr_f\.\.\.cret/);
  assert.match(h.out(), /config\.json/);
  assert.equal(h.text().includes('cr_file_key_not_a_secret'), false);
  assert.equal(h.text().includes('cr_proj_key_not_a_secret'), false);

  h.clear();
  assert.equal(await run(['verify', '--text', 'hello'], h.deps), 0);
  assert.equal(h.calls[0].options?.apiKey, 'cr_file_key_not_a_secret');

  h.deps.env = { ...h.deps.env, CLEARRUN_API_KEY: 'cr_env_key_not_a_secret' };
  h.clear();
  h.calls.length = 0;
  assert.equal(await run(['verify', '--text', 'hello'], h.deps), 0);
  assert.equal(h.calls[0].options?.apiKey, 'cr_env_key_not_a_secret');
  h.clear();
  assert.equal(await run(['whoami'], h.deps), 0);
  assert.match(h.out(), /Source: CLEARRUN_API_KEY/);
  assert.equal(h.text().includes('cr_env_key_not_a_secret'), false);

  h.clear();
  h.calls.length = 0;
  assert.equal(await run(['whoami', '--api-key', 'cr_flag_key_not_a_secret'], h.deps), 0);
  assert.match(h.out(), /Source: --api-key/);
  assert.match(h.out(), /Key: cr_f\.\.\.cret/);
  assert.equal(h.text().includes('cr_flag_key_not_a_secret'), false);
  h.calls.length = 0;
  assert.equal(await run(['verify', '--text', 'hello', '--api-key', 'cr_flag_key_not_a_secret'], h.deps), 0);
  assert.equal(h.calls[0].options?.apiKey, 'cr_flag_key_not_a_secret');
});

test('verify without a key exits 1 with the login message and does not score', async () => {
  const h = setup();
  assert.equal(await run(['verify', '--text', 'hello'], h.deps), 1);
  assert.match(h.err(), /https:\/\/api\.clearrun\.net\/account\/keys/);
  assert.match(h.err(), /npx @clearrun\/cli login/);
  assert.match(h.err(), /CLEARRUN_API_KEY/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.err().includes('\u2014'), false);
});

test('the first-run hint is printed once when no key is configured', async () => {
  const h = setup();
  assert.equal(await run(['--help'], h.deps), 0);
  assert.match(h.err(), /npx @clearrun\/cli login/);
  assert.match(h.out(), /Usage:/);
  assert.equal(statSync(h.configPath).mode & 0o777, 0o600);
  const saved = JSON.parse(readFileSync(h.configPath, 'utf8')) as { hintShown?: boolean; apiKey?: string };
  assert.equal(saved.hintShown, true);
  assert.equal(saved.apiKey, undefined);

  h.clear();
  assert.equal(await run(['--version'], h.deps), 0);
  assert.equal(h.err(), '');
  assert.match(h.out(), /^\d+\.\d+\.\d+$/);
});

test('a configured key skips the first-run hint', async () => {
  const h = setup({ CLEARRUN_API_KEY: SECRET });
  assert.equal(await run([], h.deps), 0);
  assert.equal(h.err(), '');
  assert.match(h.out(), /Usage:/);
});

test('login does not take extra inputs', async () => {
  const h = setup();
  assert.equal(await run(['login', 'extra'], h.deps), 1);
  assert.match(h.err(), /login does not take inputs/);
  assert.deepEqual(h.opened, []);
});

test('login writes under XDG_CONFIG_HOME and keeps other fields', async () => {
  const h = setup();
  const xdg = mkdtempSync(join(tmpdir(), 'clearrun-xdg-'));
  const configPath = join(xdg, 'clearrun', 'config.json');
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ hintShown: true, note: 'keep' }));
  h.deps.env = { ...h.deps.env, XDG_CONFIG_HOME: xdg };
  assert.equal(await run(['login'], h.deps), 0);
  const saved = JSON.parse(readFileSync(configPath, 'utf8')) as { apiKey?: string; hintShown?: boolean; note?: string };
  assert.equal(saved.apiKey, SECRET);
  assert.equal(saved.hintShown, true);
  assert.equal(saved.note, 'keep');
  assert.equal(existsSync(h.configPath), false);
  assert.equal(h.text().includes(SECRET), false);
  assert.equal(statSync(configPath).mode & 0o777, 0o600);
});
