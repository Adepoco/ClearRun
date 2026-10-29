// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// clearrun login, logout, and whoami. The saved key lives in the user config
// file shared with the SDK and the MCP server.

import { spawn } from 'child_process';
import {
  API_KEYS_URL,
  CredentialFileError,
  MISSING_API_KEY_MESSAGE,
  checkApiKey,
  maskApiKey,
  readCredentialFile,
  resolveClearRunApiKey,
  userConfigPath,
  writeCredentialFile,
  type FetchLike,
} from '@clearrun/sdk';

export interface AuthIo {
  env: Record<string, string | undefined>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  openUrl?: (url: string) => void;
  readLine?: (prompt: string) => Promise<string>;
  /** Passed through to the key check. The check does not call it while no free endpoint exists. */
  fetch?: FetchLike;
  /** Project config apiKey, the lowest priority source. */
  projectApiKey?: string;
  baseUrl?: string;
}

export type CliKeySource = 'flag' | 'env' | 'config' | 'project';

export interface CliResolvedKey {
  apiKey: string;
  source: CliKeySource;
  configPath?: string;
}

/** Flag, then CLEARRUN_API_KEY, then the user config file, then the project config. */
export function resolveCliApiKey(
  env: Record<string, string | undefined>,
  flag?: string,
  projectApiKey?: string
): CliResolvedKey | undefined {
  const resolved = resolveClearRunApiKey({ apiKey: flag, env });
  if (resolved?.source === 'option') return { apiKey: resolved.apiKey, source: 'flag' };
  if (resolved?.source === 'env') return { apiKey: resolved.apiKey, source: 'env' };
  if (resolved?.source === 'config') {
    return { apiKey: resolved.apiKey, source: 'config', configPath: resolved.configPath };
  }
  const project = projectApiKey?.trim() ?? '';
  if (project) return { apiKey: project, source: 'project' };
  return undefined;
}

function sourceLabel(resolved: CliResolvedKey): string {
  if (resolved.source === 'flag') return '--api-key';
  if (resolved.source === 'env') return 'CLEARRUN_API_KEY';
  if (resolved.source === 'project') return 'clearrun.config.json';
  return resolved.configPath ?? 'the ClearRun config file';
}

export function openBrowser(url: string): void {
  const child =
    process.platform === 'darwin'
      ? spawn('open', [url], { stdio: 'ignore', detached: true })
      : process.platform === 'win32'
        ? spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true, windowsHide: true })
        : spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
  child.on('error', () => {
    // The URL is already printed. A missing opener should not crash login.
  });
  child.unref();
}

/** Reads one line from stdin. On a TTY the characters are not echoed. */
export function readSecret(prompt: string): Promise<string> {
  const stdin = process.stdin;
  const stderr = process.stderr;
  stderr.write(prompt);
  if (!stdin.isTTY) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stdin.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
      stdin.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text.split(/\r?\n/, 1)[0] ?? '');
      });
      stdin.on('error', reject);
      stdin.resume();
    });
  }

  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let data = '';
    const finish = (value: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stderr.write('\n');
      resolve(value);
    };
    const onData = (buf: Buffer) => {
      const text = buf.toString('utf8');
      for (const ch of text) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          finish(data);
          return;
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          reject(new Error('Login cancelled.'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          data = data.slice(0, -1);
          continue;
        }
        data += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function configPathFor(env: Record<string, string | undefined>): string | undefined {
  return userConfigPath(env);
}

/** Records that the missing-key message was shown, without printing it again. */
export function markHintShown(env: Record<string, string | undefined>): void {
  const path = configPathFor(env);
  if (!path) return;
  try {
    const existing = readCredentialFile(path);
    if (existing?.hintShown) return;
    writeCredentialFile(path, { hintShown: true });
  } catch {
    // A later run may print the hint if the flag could not be saved.
  }
}

/** Prints the missing-key message once per machine, until a later run finds a key. */
export function showFirstRunHint(io: AuthIo): void {
  if (resolveCliApiKey(io.env, undefined, io.projectApiKey)) return;
  const path = configPathFor(io.env);
  if (path) {
    try {
      const existing = readCredentialFile(path);
      if (existing?.hintShown) return;
    } catch (err: unknown) {
      io.stderr(err instanceof CredentialFileError ? err.message : MISSING_API_KEY_MESSAGE);
      return;
    }
  }
  io.stderr(MISSING_API_KEY_MESSAGE);
  if (!path) return;
  try {
    writeCredentialFile(path, { hintShown: true });
  } catch {
    // The hint was printed. If the file could not be written, a later run may print it again.
  }
}

export async function loginCommand(io: AuthIo): Promise<number> {
  const path = configPathFor(io.env);
  io.stdout('Create a ClearRun API key (Pro plan or higher):');
  io.stdout(API_KEYS_URL);
  io.stdout('Sign in on that page if you need an account. Then paste the key here.');
  try {
    (io.openUrl ?? openBrowser)(API_KEYS_URL);
  } catch {
    io.stderr('Could not open a browser. Use the link above.');
  }

  let pasted = '';
  try {
    pasted = (await (io.readLine ?? readSecret)('Paste your API key: ')).trim();
  } catch (err: unknown) {
    io.stderr(err instanceof Error ? err.message : 'Login cancelled.');
    return 1;
  }
  if (!pasted) {
    io.stderr('No API key was entered.');
    return 1;
  }
  if (!path) {
    io.stderr('Could not find a home directory to save the key. Set CLEARRUN_API_KEY instead.');
    return 1;
  }

  const check = await checkApiKey(pasted, io.baseUrl ?? 'https://api.clearrun.net', io.fetch);
  if (check.checked && check.ok === false) {
    io.stderr(check.message);
    return 1;
  }

  try {
    writeCredentialFile(path, { apiKey: pasted, hintShown: true });
  } catch (err: unknown) {
    if (err instanceof CredentialFileError) {
      io.stderr(err.message);
      return 1;
    }
    io.stderr('Could not save the ClearRun config file.');
    return 1;
  }

  const masked = maskApiKey(pasted);
  io.stdout(`Saved the API key to ${path}`);
  if (masked && masked !== pasted) io.stdout(`Key: ${masked}`);
  io.stdout(check.message);
  return 0;
}

export function logoutCommand(io: AuthIo): number {
  const path = configPathFor(io.env);
  if (!path) {
    io.stderr('Could not find a home directory for the ClearRun config file.');
    return 1;
  }
  try {
    const existing = readCredentialFile(path);
    if (!existing?.apiKey) {
      io.stdout('No saved ClearRun API key to remove.');
    } else {
      writeCredentialFile(path, { apiKey: null });
      io.stdout('Removed the saved ClearRun API key.');
    }
  } catch (err: unknown) {
    if (err instanceof CredentialFileError) {
      io.stderr(err.message);
      return 1;
    }
    io.stderr('Could not update the ClearRun config file.');
    return 1;
  }
  if ((io.env.CLEARRUN_API_KEY ?? '').trim()) {
    io.stdout('CLEARRUN_API_KEY is set in this shell, so commands still use that key.');
  }
  return 0;
}

export function whoamiCommand(io: AuthIo, flag?: string): number {
  let resolved: CliResolvedKey | undefined;
  try {
    resolved = resolveCliApiKey(io.env, flag, io.projectApiKey);
  } catch (err: unknown) {
    if (err instanceof CredentialFileError) {
      io.stderr(err.message);
      return 1;
    }
    throw err;
  }
  if (!resolved) {
    io.stderr(MISSING_API_KEY_MESSAGE);
    return 1;
  }
  const masked = maskApiKey(resolved.apiKey);
  if (masked && masked !== resolved.apiKey) io.stdout(`Key: ${masked}`);
  else io.stdout('A key is configured.');
  io.stdout(`Source: ${sourceLabel(resolved)}`);
  return 0;
}
