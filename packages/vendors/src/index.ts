// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
/**
 * @clearrun/vendors — the OPEN model-integration surface.
 *
 * Folds the former engine/{adapters, providers, registry} into the public
 * vendors package (open adoption surface). Vendor-agnostic transport + model
 * registry only — NO honesty scoring or governance logic lives here.
 *
 * INVARIANT: honesty evaluation is vendor-blind. Adapters are transport only.
 */

// Model + vendor registry (source of truth for model/vendor metadata, routing).
export * from './registry';

// Vendor adapters (v0.1.0: OpenAI, Anthropic, Google GenAI).
export * from './adapters';

export * from './providers';
