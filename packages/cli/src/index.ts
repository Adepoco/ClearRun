#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun

// ============================================================================
// CLEARRUN CLI
// Usage: npx clearrun verify <file>
//        npx clearrun verify --text "AI response text"
//        npx clearrun --help
// ============================================================================

import { run } from './cli';

export * from './cli';
export { verify } from './verify';
export type { PublicVerdict, VerifyOptions } from './verify';

if (require.main === module) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      console.error(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      process.exitCode = 1;
    }
  );
}
