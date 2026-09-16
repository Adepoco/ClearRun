#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun

// ============================================================================
// CLEARRUN CLI
// Usage: npx clearrun verify <file>
//        npx clearrun verify --text "AI response text"
// ============================================================================

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { verify } from './verify';

interface ClearRunConfig {
  paths?: string[];
  threshold?: number;
  maxIssues?: number;
  baseUrl?: string;
  apiKey?: string;
}

function loadConfig(): ClearRunConfig | null {
  const configPath = resolve(process.cwd(), 'clearrun.config.json');
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

const HELP = `
ClearRun CLI — Score AI responses for reliability.

Usage:
  clearrun verify <file>           Score a file's contents
  clearrun verify --text "..."     Score inline text
  clearrun --help                  Show this help

Options:
  --api-key <key>    API key (or set CLEARRUN_API_KEY env var)
  --base-url <url>   API base URL (default: https://api.clearrun.net)
  --json             Output raw JSON instead of formatted text
  --config <path>    Path to clearrun.config.json

Config file (clearrun.config.json):
  { "paths": ["prompts/", "responses/"], "threshold": 70 }

Examples:
  clearrun verify response.txt
  clearrun verify --text "The capital of France is Paris."
  clearrun verify response.txt --json
`.trim();

interface CliOptions {
  file?: string;
  text?: string;
  apiKey?: string;
  baseUrl?: string;
  json: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = { json: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    }

    if (arg === 'verify') continue;

    if (arg === '--text' && args[i + 1]) {
      opts.text = args[++i];
      continue;
    }
    if (arg === '--api-key' && args[i + 1]) {
      opts.apiKey = args[++i];
      continue;
    }
    if (arg === '--base-url' && args[i + 1]) {
      opts.baseUrl = args[++i];
      continue;
    }
    if (arg === '--json') {
      opts.json = true;
      continue;
    }

    if (!arg.startsWith('-') && !opts.file) {
      opts.file = arg;
    }
  }

  return opts;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || (args.length === 1 && args[0] === 'verify')) {
    console.log(HELP);
    process.exit(0);
  }

  const command = args[0];
  if (command !== 'verify') {
    console.error(`Unknown command: ${command}`);
    console.log('Run "clearrun --help" for usage.');
    process.exit(1);
  }

  const opts = parseArgs(args);
  let text: string;

  if (opts.text) {
    text = opts.text;
  } else if (opts.file) {
    const filePath = resolve(process.cwd(), opts.file);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${opts.file}`);
      process.exit(1);
    }
    text = readFileSync(filePath, 'utf-8');
  } else {
    console.error('Provide a file path or --text "..."');
    process.exit(1);
  }

  if (!text.trim()) {
    console.error('Input text is empty.');
    process.exit(1);
  }

  const config = loadConfig();
  const apiKey = opts.apiKey ?? process.env.CLEARRUN_API_KEY ?? config?.apiKey;
  const baseUrl = opts.baseUrl ?? config?.baseUrl;

  try {
    const verdict = await verify(text, {
      apiKey,
      baseUrl,
    });

    if (opts.json) {
      console.log(JSON.stringify(verdict, null, 2));
      return;
    }

    console.log('');
    console.log(`ClearRun Score: ${verdict.score}`);
    console.log(`Grade: ${verdict.grade}`);
    console.log(`Risk: ${verdict.risk.charAt(0).toUpperCase() + verdict.risk.slice(1)}`);

    if (verdict.issues.length === 0) {
      console.log('Issues: none');
    } else {
      console.log('Issues:');
      for (const issue of verdict.issues) {
        console.log(`  * ${issue}`);
      }
    }

    console.log('');
    console.log(verdict.summary);
    console.log('');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

main();
