// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// CLI logic, kept apart from the bin entry (index.ts) so it can be tested
// without a network: `run()` takes its I/O and the scoring call as deps.

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, extname, join, relative, resolve } from 'path';
import { CredentialFileError, MISSING_API_KEY_MESSAGE } from '@clearrun/sdk';
import {
  loginCommand,
  logoutCommand,
  markHintShown,
  resolveCliApiKey,
  showFirstRunHint,
  whoamiCommand,
  type AuthIo,
} from './auth';
import { verify as hostedVerify, type PublicVerdict, type VerifyOptions } from './verify';

export const VERSION = '0.2.0';
export const CONFIG_FILENAME = 'clearrun.config.json';
/** File types picked up when a config or CLI path is a directory. */
export const DIRECTORY_EXTENSIONS = ['.txt', '.md', '.markdown'];

export interface ClearRunConfig {
  /** Files or directories to score when no file or --text is given. Relative to the config file. */
  paths?: string[];
  /** Minimum passing score, 0 to 100. Any input scoring below it makes the run exit 1. */
  threshold?: number;
  /** Maximum number of issues allowed per input. More makes the run exit 1. */
  maxIssues?: number;
  baseUrl?: string;
  apiKey?: string;
}

export const HELP = `
ClearRun CLI ${VERSION}. Score AI responses for reliability.

Usage:
  clearrun login                        Open the API key page and save a key
  clearrun logout                       Remove the saved key
  clearrun whoami                       Show whether a key is configured (masked)
  clearrun verify <file> [<file> ...]   Score one or more files
  clearrun verify --text "..."          Score inline text
  clearrun verify                       Score the "paths" in clearrun.config.json
  clearrun --help                       Show this help
  clearrun --version                    Show the CLI version

Options:
  --api-key <key>      API key. Overrides CLEARRUN_API_KEY and saved config
  --base-url <url>     API base URL (default: https://api.clearrun.net)
  --config <path>      Path to a project config file (default: ./clearrun.config.json)
  --threshold <0-100>  Exit 1 if any input scores below this (overrides config)
  --json               Output raw JSON instead of formatted text

Key lookup order:
  1. --api-key
  2. CLEARRUN_API_KEY
  3. ~/.config/clearrun/config.json from clearrun login
     (XDG_CONFIG_HOME/clearrun/config.json when XDG_CONFIG_HOME is set)
  4. apiKey in clearrun.config.json

Config file (clearrun.config.json), every field optional:
  {
    "paths": ["responses/", "answer.txt"],
    "threshold": 70,
    "maxIssues": 3,
    "baseUrl": "https://api.clearrun.net",
    "apiKey": "..."
  }
  "paths" are relative to the config file. Directories are searched
  recursively for .txt and .md files (dot folders and node_modules skipped).
  Prefer CLEARRUN_API_KEY or clearrun login over apiKey in the project file.

Exit codes:
  0  every input scored and passed threshold and maxIssues
  1  an input failed threshold or maxIssues, a request failed, or bad usage

Examples:
  npx @clearrun/cli login
  clearrun verify response.txt
  clearrun verify --text "The capital of France is Paris."
  clearrun verify response.txt --json
  clearrun verify --config ci/clearrun.config.json --threshold 75
`.trim();

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export interface CliOptions {
  command?: 'verify' | 'login' | 'logout' | 'whoami';
  help: boolean;
  version: boolean;
  files: string[];
  text?: string;
  apiKey?: string;
  baseUrl?: string;
  configPath?: string;
  threshold?: number;
  json: boolean;
}

const VALUE_FLAGS = new Set(['--text', '--api-key', '--base-url', '--config', '--threshold']);

function parseThreshold(raw: unknown, source: string): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new CliUsageError(`${source} must be a number from 0 to 100`);
  }
  return n;
}

export function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = { help: false, version: false, files: [], json: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      opts.version = true;
      continue;
    }
    if (arg === '--json') {
      opts.json = true;
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = args[i + 1];
      if (value === undefined || (value.startsWith('--') && value !== '--')) {
        throw new CliUsageError(`${arg} needs a value`);
      }
      i++;
      if (arg === '--text') opts.text = value;
      else if (arg === '--api-key') opts.apiKey = value;
      else if (arg === '--base-url') opts.baseUrl = value;
      else if (arg === '--config') opts.configPath = value;
      else if (arg === '--threshold') opts.threshold = parseThreshold(value, '--threshold');
      continue;
    }
    if (arg.startsWith('-') && arg !== '-') {
      throw new CliUsageError(`Unknown option: ${arg}`);
    }

    // Positional.
    if (opts.command === undefined) {
      if (arg === 'help') {
        opts.help = true;
        continue;
      }
      if (arg === 'verify' || arg === 'login' || arg === 'logout' || arg === 'whoami') {
        opts.command = arg;
        continue;
      }
      throw new CliUsageError(`Unknown command: ${arg}`);
    }
    opts.files.push(arg);
  }

  return opts;
}

export interface LoadedConfig {
  config: ClearRunConfig;
  /** Directory that relative config paths resolve against. */
  baseDir: string;
  /** Absolute path of the file that was read, if any. */
  file?: string;
}

export function loadConfig(cwd: string, explicitPath?: string): LoadedConfig {
  const file = resolve(cwd, explicitPath ?? CONFIG_FILENAME);
  if (!existsSync(file)) {
    if (explicitPath) throw new CliUsageError(`Config file not found: ${explicitPath}`);
    return { config: {}, baseDir: cwd };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    throw new CliUsageError(`Config file is not valid JSON: ${relative(cwd, file) || file}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CliUsageError('Config file must contain a JSON object');
  }

  const r = raw as Record<string, unknown>;
  const config: ClearRunConfig = {};
  if (r.paths !== undefined) {
    if (!Array.isArray(r.paths) || !r.paths.every((p) => typeof p === 'string' && p.length > 0)) {
      throw new CliUsageError('Config "paths" must be an array of non-empty strings');
    }
    config.paths = r.paths as string[];
  }
  if (r.threshold !== undefined) config.threshold = parseThreshold(r.threshold, 'Config "threshold"');
  if (r.maxIssues !== undefined) {
    if (typeof r.maxIssues !== 'number' || !Number.isInteger(r.maxIssues) || r.maxIssues < 0) {
      throw new CliUsageError('Config "maxIssues" must be a whole number, 0 or more');
    }
    config.maxIssues = r.maxIssues;
  }
  for (const key of ['baseUrl', 'apiKey'] as const) {
    if (r[key] !== undefined) {
      if (typeof r[key] !== 'string') throw new CliUsageError(`Config "${key}" must be a string`);
      config[key] = r[key] as string;
    }
  }
  return { config, baseDir: dirname(file), file };
}

function walk(dir: string, out: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && DIRECTORY_EXTENSIONS.includes(extname(entry.name).toLowerCase())) out.push(full);
  }
}

/** Expand files and directories into a de-duplicated, ordered list of files. */
export function collectFiles(paths: string[], baseDir: string): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const full = resolve(baseDir, p);
    if (!existsSync(full)) throw new CliUsageError(`File not found: ${p}`);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return Array.from(new Set(out));
}

export interface Gate {
  threshold?: number;
  maxIssues?: number;
}

/** Returns the reasons an input fails the gate; empty means it passed. */
export function gateFailures(verdict: PublicVerdict, gate: Gate): string[] {
  const reasons: string[] = [];
  if (gate.threshold !== undefined) {
    if (typeof verdict.score !== 'number') reasons.push(`no score, threshold is ${gate.threshold}`);
    else if (verdict.score < gate.threshold) reasons.push(`score ${verdict.score} is below threshold ${gate.threshold}`);
  }
  if (gate.maxIssues !== undefined) {
    const n = Array.isArray(verdict.issues) ? verdict.issues.length : 0;
    if (n > gate.maxIssues) reasons.push(`${n} issues, maxIssues is ${gate.maxIssues}`);
  }
  return reasons;
}

export interface RunDeps {
  cwd?: string;
  env?: Record<string, string | undefined>;
  verify?: (text: string, options?: VerifyOptions) => Promise<PublicVerdict>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  /** Opens the API key page. Tests pass their own function. Defaults to the system browser. */
  openUrl?: (url: string) => void;
  /** Reads the pasted key. Tests pass their own function. Defaults to a hidden stdin prompt. */
  readLine?: (prompt: string) => Promise<string>;
  /** Injectable HTTP client. Login does not call it unless a free key check exists. */
  fetch?: AuthIo['fetch'];
}

interface Input {
  label: string;
  text?: string;
  file?: string;
}

interface Result {
  input: string;
  verdict?: PublicVerdict;
  error?: string;
  failures: string[];
}

function formatVerdict(v: PublicVerdict, out: (line: string) => void): void {
  out(`ClearRun Score: ${typeof v.score === 'number' ? v.score : 'not determined'}`);
  out(`Grade: ${v.grade}`);
  if (typeof v.risk === 'string' && v.risk.length > 0) {
    out(`Risk: ${v.risk.charAt(0).toUpperCase() + v.risk.slice(1)}`);
  }
  const issues = Array.isArray(v.issues) ? v.issues : [];
  if (issues.length === 0) {
    out('Issues: none');
  } else {
    out('Issues:');
    for (const issue of issues) out(`  * ${issue}`);
  }
  out('');
  out(v.summary);
}

function authIo(env: Record<string, string | undefined>, deps: RunDeps, out: (line: string) => void, err: (line: string) => void, projectApiKey?: string): AuthIo {
  return {
    env,
    stdout: out,
    stderr: err,
    openUrl: deps.openUrl,
    readLine: deps.readLine,
    fetch: deps.fetch,
    projectApiKey,
    baseUrl: undefined,
  };
}

function projectKeyQuiet(cwd: string, configPath?: string): string {
  try {
    return loadConfig(cwd, configPath).config.apiKey?.trim() ?? '';
  } catch {
    return '';
  }
}

/** Runs the CLI and resolves to the process exit code. Never calls process.exit. */
export async function run(args: string[], deps: RunDeps = {}): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const env = deps.env ?? process.env;
  const verifyFn = deps.verify ?? hostedVerify;
  const out = deps.stdout ?? ((line: string) => console.log(line));
  const err = deps.stderr ?? ((line: string) => console.error(line));

  let opts: CliOptions;
  let loaded: LoadedConfig;
  let inputs: Input[];
  try {
    opts = parseArgs(args);
    if (opts.help || args.length === 0) {
      showFirstRunHint(authIo(env, deps, out, err, projectKeyQuiet(cwd, opts.configPath)));
      out(HELP);
      return 0;
    }
    if (opts.version) {
      showFirstRunHint(authIo(env, deps, out, err, projectKeyQuiet(cwd, opts.configPath)));
      out(VERSION);
      return 0;
    }
    if (opts.command === 'login' || opts.command === 'logout' || opts.command === 'whoami') {
      if (opts.files.length > 0 || opts.text !== undefined || opts.json) {
        throw new CliUsageError(`${opts.command} does not take inputs.`);
      }
      const io = authIo(env, deps, out, err, projectKeyQuiet(cwd, opts.configPath));
      if (opts.baseUrl) io.baseUrl = opts.baseUrl;
      if (opts.command === 'login') return await loginCommand(io);
      if (opts.command === 'logout') return logoutCommand(io);
      return whoamiCommand(io, opts.apiKey);
    }
    if (opts.command !== 'verify') {
      throw new CliUsageError('Missing command. Use "clearrun verify", or "clearrun login" to save an API key.');
    }

    loaded = loadConfig(cwd, opts.configPath);
    if (opts.text !== undefined) {
      if (opts.files.length > 0) throw new CliUsageError('Use either --text or file paths, not both');
      inputs = [{ label: '--text', text: opts.text }];
    } else if (opts.files.length > 0) {
      inputs = collectFiles(opts.files, cwd).map((f) => ({ label: relative(cwd, f) || f, file: f }));
    } else if (loaded.config.paths && loaded.config.paths.length > 0) {
      inputs = collectFiles(loaded.config.paths, loaded.baseDir).map((f) => ({ label: relative(cwd, f) || f, file: f }));
      if (inputs.length === 0) throw new CliUsageError('No .txt or .md files found in config "paths"');
    } else {
      showFirstRunHint(authIo(env, deps, out, err, loaded.config.apiKey));
      out(HELP);
      return 0;
    }
  } catch (e: unknown) {
    if (e instanceof CliUsageError) {
      err(e.message);
      err('Run "clearrun --help" for usage.');
      return 1;
    }
    throw e;
  }

  const { config } = loaded;
  const gate: Gate = { threshold: opts.threshold ?? config.threshold, maxIssues: config.maxIssues };
  let resolvedKey: ReturnType<typeof resolveCliApiKey>;
  try {
    resolvedKey = resolveCliApiKey(env, opts.apiKey, config.apiKey);
  } catch (e: unknown) {
    if (e instanceof CredentialFileError) {
      err(e.message);
      return 1;
    }
    throw e;
  }
  if (!resolvedKey) {
    err(MISSING_API_KEY_MESSAGE);
    markHintShown(env);
    return 1;
  }
  const verifyOptions: VerifyOptions = {
    apiKey: resolvedKey.apiKey,
    baseUrl: opts.baseUrl ?? config.baseUrl,
  };

  const results: Result[] = [];
  for (const input of inputs) {
    const text = input.text ?? readFileSync(input.file as string, 'utf-8');
    if (!text.trim()) {
      results.push({ input: input.label, error: 'Input text is empty.', failures: [] });
      continue;
    }
    try {
      const verdict = await verifyFn(text, verifyOptions);
      results.push({ input: input.label, verdict, failures: gateFailures(verdict, gate) });
    } catch (e: unknown) {
      results.push({ input: input.label, error: e instanceof Error ? e.message : 'Unknown error', failures: [] });
    }
  }

  const ok = results.every((r) => !r.error && r.failures.length === 0);
  const multi = inputs.length > 1;

  if (opts.json) {
    if (!multi && results[0].verdict) {
      out(JSON.stringify(results[0].verdict, null, 2));
    } else if (!multi) {
      err(`Error: ${results[0].error}`);
    } else {
      out(
        JSON.stringify(
          results.map((r) => ({
            input: r.input,
            passed: !r.error && r.failures.length === 0,
            ...(r.verdict ? { verdict: r.verdict } : {}),
            ...(r.error ? { error: r.error } : {}),
            ...(r.failures.length ? { failures: r.failures } : {}),
          })),
          null,
          2
        )
      );
    }
    if (!multi && results[0].failures.length) for (const f of results[0].failures) err(`Failed: ${f}`);
    return ok ? 0 : 1;
  }

  for (const r of results) {
    out('');
    if (multi) out(`== ${r.input}`);
    if (r.error) {
      err(multi ? `Error (${r.input}): ${r.error}` : r.error === 'Input text is empty.' ? r.error : `Error: ${r.error}`);
      continue;
    }
    formatVerdict(r.verdict as PublicVerdict, out);
    for (const f of r.failures) out(`Failed: ${f}`);
  }
  out('');
  if (multi || gate.threshold !== undefined || gate.maxIssues !== undefined) {
    const passed = results.filter((r) => !r.error && r.failures.length === 0).length;
    out(`${passed} of ${results.length} passed.`);
  }
  return ok ? 0 : 1;
}
