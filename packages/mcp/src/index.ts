#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// ClearRun MCP server (stdio).
// Usage: CLEARRUN_API_KEY=... npx @clearrun/mcp

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClearRunServer } from './server.js';
import { redactSecret } from './present.js';

export { createClearRunServer, HONESTY_NOTE, SERVER_NAME, SERVER_VERSION, TOOL_NAMES } from './server.js';
export type { ClearRunMcpOptions } from './server.js';
export { MISSING_KEY_MESSAGE, presentApiResult } from './present.js';

async function main(): Promise<void> {
  const server = createClearRunServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    const apiKey = (process.env.CLEARRUN_API_KEY ?? '').trim();
    const raw = err instanceof Error ? err.message : 'ClearRun MCP server failed to start';
    console.error(redactSecret(raw, apiKey));
    process.exitCode = 1;
  });
}
