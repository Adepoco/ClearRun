// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// @clearrun/sdk — the public client for the ClearRun honesty kernel.
//
// Both the ClearRun app and third-party builders depend ONLY on the
// HonestyKernelClient interface (from @clearrun/core-types). Production uses
// HostedApiClient (hosted API + API key). MockKernelClient is opt-in only
// (`forceMock` / `mock`). Neither imports closed code.

import type { HonestyKernelClient, HostedApiConfig } from '@clearrun/core-types';
import {
  MissingApiKeyError,
  resolveClearRunApiKey,
  type ResolveApiKeyOptions,
} from './credentials';
import { HostedApiClient, type HostedClientDeps } from './hosted-client';
import { MockKernelClient, type MockClientOptions } from './mock-client';

export { HostedApiClient, HostedApiError } from './hosted-client';
export type { FetchLike, HostedClientDeps } from './hosted-client';
export { MockKernelClient } from './mock-client';
export type { MockClientOptions } from './mock-client';
export {
  API_KEYS_URL,
  API_KEY_VERIFY_PATH,
  MISSING_API_KEY_MESSAGE,
  MissingApiKeyError,
  CredentialFileError,
  checkApiKey,
  maskApiKey,
  readCredentialFile,
  resolveClearRunApiKey,
  userConfigPath,
  writeCredentialFile,
} from './credentials';
export type {
  ApiKeySource,
  CredentialFile,
  CredentialUpdates,
  KeyCheckResult,
  ResolveApiKeyOptions,
  ResolvedApiKey,
} from './credentials';

// Re-export the boundary types so consumers can import everything from the SDK.
export type {
  HonestyKernelClient,
  HostedApiConfig,
  Verdict,
  VerdictGrade,
  VerdictRisk,
  FailureCategory,
  ConfidenceInterval,
  ComponentSignal,
  EvaluateRequest,
  EvaluateResponse,
  ChatRequest,
  ChatResponse,
  ScoreRequest,
  ScoreResponse,
  VerifyRequest,
  VerifyResponse,
} from '@clearrun/core-types';

export interface CreateKernelClientOptions {
  /** Hosted API config. `apiKey` may also come from `CLEARRUN_API_KEY`. */
  hosted?: Partial<HostedApiConfig> & { apiKey?: string };
  /** Opt in to MockKernelClient (local development / tests only). */
  forceMock?: boolean;
  /** Mock options. Passing this object is also an explicit mock opt-in. */
  mock?: MockClientOptions;
  /** Dependency injection for the hosted client (e.g. a custom fetch). */
  deps?: HostedClientDeps;
  /**
   * Environment used for CLEARRUN_API_KEY and the user config path.
   * Defaults to process.env.
   */
  env?: ResolveApiKeyOptions['env'];
}

/**
 * Factory: returns a HonestyKernelClient.
 * Requires a hosted API key (`hosted.apiKey`, `CLEARRUN_API_KEY`, or the
 * CLI config file) unless the caller explicitly opts into MockKernelClient
 * via `forceMock` or `mock`. Never silently returns a mock score.
 * A missing key throws MissingApiKeyError.
 */
export function createKernelClient(options: CreateKernelClientOptions = {}): HonestyKernelClient {
  const { hosted, forceMock, mock, deps } = options;
  const mockOptIn = forceMock === true || mock !== undefined;
  if (mockOptIn) {
    return new MockKernelClient(mock);
  }
  const resolved = resolveClearRunApiKey({
    apiKey: hosted?.apiKey,
    env: options.env ?? process.env,
  });
  if (!resolved) {
    throw new MissingApiKeyError();
  }
  return new HostedApiClient(
    { baseUrl: hosted?.baseUrl, apiKey: resolved.apiKey, timeoutMs: hosted?.timeoutMs },
    deps
  );
}
