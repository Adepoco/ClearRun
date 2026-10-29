// SPDX-License-Identifier: MIT
// Key lookup, the missing-key error, and config file permissions. No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  API_KEY_VERIFY_PATH,
  API_KEYS_URL,
  MISSING_API_KEY_MESSAGE,
  MissingApiKeyError,
  checkApiKey,
  createKernelClient,
  HostedApiClient,
  maskApiKey,
  resolveClearRunApiKey,
  userConfigPath,
  writeCredentialFile,
  type FetchLike,
} from '../src/index';

const SECRET = 'cr_test_key_not_a_secret';

function home(): string {
  return mkdtempSync(join(tmpdir(), 'clearrun-sdk-home-'));
}

test('missing-key message names the keys page and the login command', () => {
  const err = new MissingApiKeyError();
  assert.equal(err.message, MISSING_API_KEY_MESSAGE);
  assert.equal(err.signupUrl, API_KEYS_URL);
  assert.equal(err.code, 'MISSING_API_KEY');
  assert.match(err.message, /https:\/\/api\.clearrun\.net\/account\/keys/);
  assert.match(err.message, /npx @clearrun\/cli login/);
  assert.match(err.message, /CLEARRUN_API_KEY/);
  assert.equal(err.message.includes(SECRET), false);
  assert.equal(err.message.includes('\u2014'), false);
});

test('maskApiKey never returns the full key', () => {
  const masked = maskApiKey(SECRET);
  assert.equal(masked, 'cr_t...cret');
  assert.equal(masked === SECRET, false);
  assert.equal(masked.includes(SECRET), false);
  assert.equal(maskApiKey('short'), '****');
  assert.equal(maskApiKey('   '), '');
});

test('user config path follows XDG_CONFIG_HOME, then HOME', () => {
  assert.equal(userConfigPath({ XDG_CONFIG_HOME: '/xdg', HOME: '/home/me' }), join('/xdg', 'clearrun', 'config.json'));
  assert.equal(userConfigPath({ HOME: '/home/me' }), join('/home/me', '.config', 'clearrun', 'config.json'));
  assert.equal(userConfigPath({ USERPROFILE: 'C:\\Users\\me' }), join('C:\\Users\\me', '.config', 'clearrun', 'config.json'));
  assert.equal(userConfigPath({}), undefined);
});

test('key resolution order is explicit, then CLEARRUN_API_KEY, then the config file', () => {
  const dir = home();
  const configPath = userConfigPath({ HOME: dir }) as string;
  writeCredentialFile(configPath, { apiKey: 'cr_file_key_not_a_secret' });
  assert.equal(statSync(configPath).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(configPath)).mode & 0o777, 0o700);

  const fromFile = resolveClearRunApiKey({ env: { HOME: dir } });
  assert.equal(fromFile?.source, 'config');
  assert.equal(fromFile?.apiKey, 'cr_file_key_not_a_secret');

  const fromEnv = resolveClearRunApiKey({ env: { HOME: dir, CLEARRUN_API_KEY: 'cr_env_key_not_a_secret' } });
  assert.equal(fromEnv?.source, 'env');
  assert.equal(fromEnv?.apiKey, 'cr_env_key_not_a_secret');

  const fromOption = resolveClearRunApiKey({
    apiKey: 'cr_flag_key_not_a_secret',
    env: { HOME: dir, CLEARRUN_API_KEY: 'cr_env_key_not_a_secret' },
  });
  assert.equal(fromOption?.source, 'option');
  assert.equal(fromOption?.apiKey, 'cr_flag_key_not_a_secret');

  const blankOption = resolveClearRunApiKey({ apiKey: '   ', env: { CLEARRUN_API_KEY: 'cr_env_key_not_a_secret' } });
  assert.equal(blankOption?.source, 'env');
});

test('createKernelClient uses the config file and throws MissingApiKeyError when nothing is set', () => {
  const dir = home();
  assert.throws(
    () => createKernelClient({ env: { HOME: dir } }),
    (err: unknown) => err instanceof MissingApiKeyError && err.message === MISSING_API_KEY_MESSAGE
  );

  const configPath = userConfigPath({ HOME: dir }) as string;
  writeCredentialFile(configPath, { apiKey: SECRET });
  const client = createKernelClient({
    env: { HOME: dir },
    deps: { fetch: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as FetchLike },
  });
  assert.ok(client instanceof HostedApiClient);

  const fromEnv = createKernelClient({
    env: { HOME: dir, CLEARRUN_API_KEY: 'cr_env_key_not_a_secret' },
    deps: { fetch: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as FetchLike },
  });
  assert.ok(fromEnv instanceof HostedApiClient);
});

test('a corrupt config file is reported without echoing its contents', () => {
  const dir = home();
  const configPath = userConfigPath({ HOME: dir }) as string;
  writeCredentialFile(configPath, { apiKey: SECRET });
  writeFileSync(configPath, '{not json');
  assert.throws(
    () => resolveClearRunApiKey({ env: { HOME: dir } }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /not valid JSON/);
      assert.equal(err.message.includes(SECRET), false);
      assert.equal(err.message.includes('not json'), false);
      return true;
    }
  );
});

test('checkApiKey does not call the network when no free endpoint exists', async () => {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    throw new Error('network should not be called');
  };
  const result = await checkApiKey(SECRET, 'https://api.clearrun.net', fetch);
  assert.deepEqual(calls, []);
  assert.equal(result.checked, false);
  assert.equal(result.message.includes(SECRET), false);
  assert.equal(API_KEY_VERIFY_PATH, '');
});
