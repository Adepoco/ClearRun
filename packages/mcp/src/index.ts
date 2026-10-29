#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// ClearRun MCP server (stdio).
// Usage: CLEARRUN_API_KEY=... npx @clearrun/mcp

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MISSING_API_KEY_MESSAGE, resolveClearRunApiKey } from '@clearrun/sdk';
import { createClearRunServer } from './server.js';
import { redactSecret } from './present.js';

export { createClearRunServer, HONESTY_NOTE, SERVER_NAME, SERVER_VERSION, TOOL_NAMES } from './server.js';
export type { ClearRunMcpOptions } from './server.js';
export { MISSING_KEY_MESSAGE, presentApiResult } from './present.js';

/** Logs the missing-key message to stderr when no key is configured. Does not log a key. */
export function warnIfApiKeyMissing(
  env: NodeJS.ProcessEnv = process.env,
  write: (line: string) => void = (line) => {
    console.error(line);
  }
): void {
  if (!resolveClearRunApiKey({ env })) write(MISSING_API_KEY_MESSAGE);
}

async function main(): Promise<void> {
  warnIfApiKeyMissing();
  const server = createClearRunServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    const apiKey = resolveClearRunApiKey()?.apiKey ?? '';
    const raw = err instanceof Error ? err.message : 'ClearRun MCP server failed to start';
    console.error(redactSecret(raw, apiKey));
    process.exitCode = 1;
  });
}
