// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// @clearrun/scoring (OPEN shim) — UI mapping only.
//
// The numeric scoring formula (calculator.ts) is CLOSED and was moved to the
// private kernel repo (CV-ClearRun-core) during the open-core restructure.
// This package now contains only the UI-safe mapping layer, which consumes a
// finished Verdict / honesty state and never computes a score.

export * from './ui-mapper';
