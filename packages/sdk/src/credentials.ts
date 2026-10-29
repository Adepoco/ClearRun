// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// Where a ClearRun API key comes from, and the error used when it is missing.
//
// Lookup order for an implicit key:
//   1. CLEARRUN_API_KEY
//   2. ~/.config/clearrun/config.json (written by `clearrun login`)
// An explicit apiKey argument is checked before either of those.
//
// Login does not call the API. The hosted routes that accept a bearer key
// (POST /api/score, POST /api/evaluate, POST /api/chat) spend credits.
// GET /api/verify/{id} does not check a key. GET /api/account, GET /api/keys,
// and GET /api/credits expect a browser session, and they reject a bearer key.
// API_KEY_VERIFY_PATH stays empty so nothing in this file performs that call.
//
// A browser device-login flow, where the CLI receives a key without a paste,
// needs hosted endpoints this repo does not ship:
//   POST /api/cli/device        -> { device_code, user_code, verification_url, expires_in, interval }
//   POST /api/cli/device/token  -> { status: "pending" } or { api_key } after approval

import { dirname, join } from 'path';
import type { FetchLike } from './hosted-client';

/** Page where a signed-in user creates an API key. Signed-out visitors go to /login. */
export const API_KEYS_URL = 'https://api.clearrun.net/account/keys';

export const MISSING_API_KEY_MESSAGE =
  'No ClearRun API key is configured. Create a key at https://api.clearrun.net/account/keys (Pro plan or higher). Then run `npx @clearrun/cli login`, or set CLEARRUN_API_KEY.';

/**
 * Path of a cheap authenticated key check, relative to the API base URL.
 * Empty means login must not call the network.
 */
export const API_KEY_VERIFY_PATH = '';

export class MissingApiKeyError extends Error {
  readonly code = 'MISSING_API_KEY' as const;
  readonly signupUrl = API_KEYS_URL;

  constructor(message: string = MISSING_API_KEY_MESSAGE) {
    super(message);
    this.name = 'MissingApiKeyError';
  }
}

export class CredentialFileError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.name = 'CredentialFileError';
    this.path = path;
  }
}

export type ApiKeySource = 'option' | 'env' | 'config';

export interface ResolvedApiKey {
  apiKey: string;
  source: ApiKeySource;
  /** Set when source is `config`. */
  configPath?: string;
}

export interface ResolveApiKeyOptions {
  /** Explicit key. Wins over the environment and the config file. */
  apiKey?: string;
  /** Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Override the user config path. Used by tests. */
  configPath?: string;
}

interface FsLike {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
  writeFileSync(path: string, data: string, options?: { mode?: number }): void;
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void;
  chmodSync(path: string, mode: number): void;
  renameSync(from: string, to: string): void;
  unlinkSync(path: string): void;
}

function loadFs(): FsLike | undefined {
  try {
    return require('fs') as FsLike;
  } catch {
    return undefined;
  }
}

/**
 * User config path. `$XDG_CONFIG_HOME/clearrun/config.json` when that variable
 * is set, otherwise `$HOME/.config/clearrun/config.json` (or USERPROFILE).
 * Returns undefined when no home directory is available, so callers skip the file.
 */
export function userConfigPath(env: Record<string, string | undefined> = process.env): string | undefined {
  const xdg = env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, 'clearrun', 'config.json');
  const home = (env.HOME ?? env.USERPROFILE ?? '').trim();
  if (!home) return undefined;
  return join(home, '.config', 'clearrun', 'config.json');
}

export interface CredentialFile {
  apiKey?: string;
  hintShown: boolean;
  raw: Record<string, unknown>;
}

/** Reads the user config. Missing file returns undefined. Invalid JSON throws. */
export function readCredentialFile(configPath: string): CredentialFile | undefined {
  const fs = loadFs();
  if (!fs || !fs.existsSync(configPath)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    throw new CredentialFileError(configPath, `ClearRun config file is not valid JSON: ${configPath}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CredentialFileError(configPath, `ClearRun config file must contain a JSON object: ${configPath}`);
  }

  const raw = parsed as Record<string, unknown>;
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
  return {
    apiKey: apiKey || undefined,
    hintShown: raw.hintShown === true,
    raw,
  };
}

export interface CredentialUpdates {
  /** Set a key, or null to remove it. Omit to leave the stored key alone. */
  apiKey?: string | null;
  hintShown?: boolean;
}

/** Writes the user config. The file is mode 0600 and the directory is mode 0700. */
export function writeCredentialFile(configPath: string, updates: CredentialUpdates): void {
  const fs = loadFs();
  if (!fs) {
    throw new CredentialFileError(configPath, `Could not save the ClearRun config file: ${configPath}`);
  }

  let raw: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    const existing = readCredentialFile(configPath);
    raw = { ...(existing?.raw ?? {}) };
  }
  if (updates.apiKey === null) delete raw.apiKey;
  else if (typeof updates.apiKey === 'string') raw.apiKey = updates.apiKey;
  if (updates.hintShown !== undefined) raw.hintShown = updates.hintShown;

  const dir = dirname(configPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Some platforms reject chmod. The create mode above is the other attempt.
  }

  const tmp = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(tmp, 0o600);
  } catch {
    // Same as the directory chmod above.
  }
  try {
    fs.renameSync(tmp, configPath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // The temp file is mode 0600. Leaving it is safer than logging its contents.
    }
    throw err;
  }
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    // The write itself used mode 0600.
  }
}

/**
 * Resolves a key. Explicit apiKey, then CLEARRUN_API_KEY, then the user config file.
 * A blank explicit value is treated as unset so the environment can still supply a key.
 */
export function resolveClearRunApiKey(options: ResolveApiKeyOptions = {}): ResolvedApiKey | undefined {
  const explicit = options.apiKey?.trim() ?? '';
  if (explicit) return { apiKey: explicit, source: 'option' };

  const env = options.env ?? process.env;
  const fromEnv = (env.CLEARRUN_API_KEY ?? '').trim();
  if (fromEnv) return { apiKey: fromEnv, source: 'env' };

  const configPath = options.configPath ?? userConfigPath(env);
  if (!configPath) return undefined;
  const file = readCredentialFile(configPath);
  if (!file?.apiKey) return undefined;
  return { apiKey: file.apiKey, source: 'config', configPath };
}

/** Masks a key for display. The result never contains the full key. */
export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) return '';
  if (key.length < 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export interface KeyCheckResult {
  checked: boolean;
  ok?: boolean;
  message: string;
}

/**
 * Checks a key when API_KEY_VERIFY_PATH is set. With the path empty, this
 * returns without calling fetch.
 */
export async function checkApiKey(
  apiKey: string,
  baseUrl: string,
  fetchImpl?: FetchLike
): Promise<KeyCheckResult> {
  if (!API_KEY_VERIFY_PATH) {
    return {
      checked: false,
      message:
        'Login saves the key on this machine. It does not call api.clearrun.net, because scoring routes spend credits and account routes use a browser session.',
    };
  }
  if (!fetchImpl) {
    return { checked: false, message: 'Login could not check the key because no HTTP client was available.' };
  }
  const root = baseUrl.replace(/\/+$/, '');
  const res = await fetchImpl(`${root}${API_KEY_VERIFY_PATH}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (res.ok) return { checked: true, ok: true, message: 'API key verified.' };
  return { checked: true, ok: false, message: `ClearRun rejected the API key (${res.status}).` };
}
