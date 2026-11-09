#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun

// ============================================================================
// CLEARRUN CLI
// Usage: npx clearrun score <file>
//        npx clearrun score --text "AI response text"
//        npx clearrun verify <verdictId>
//        npx clearrun --help
// ============================================================================

import { run } from './cli';

export * from './cli';
export { lookupVerdict, scoreText } from './verify';
export type { LookupResult, PublicVerdict, VerifyOptions } from './verify';

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
