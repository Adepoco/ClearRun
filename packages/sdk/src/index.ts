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
import { HostedApiClient, type HostedClientDeps } from './hosted-client';
import { MockKernelClient, type MockClientOptions } from './mock-client';

export { HostedApiClient, HostedApiError } from './hosted-client';
export type { FetchLike, HostedClientDeps } from './hosted-client';
export { MockKernelClient } from './mock-client';
export type { MockClientOptions } from './mock-client';

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
}

const MISSING_KEY =
  'No CLEARRUN_API_KEY configured; pass { forceMock: true } for local development';

/**
 * Factory: returns a HonestyKernelClient.
 * Requires a hosted API key (`hosted.apiKey` or `CLEARRUN_API_KEY`) unless the
 * caller explicitly opts into MockKernelClient via `forceMock` or `mock`.
 * Never silently returns a mock score.
 */
export function createKernelClient(options: CreateKernelClientOptions = {}): HonestyKernelClient {
  const { hosted, forceMock, mock, deps } = options;
  const mockOptIn = forceMock === true || mock !== undefined;
  if (mockOptIn) {
    return new MockKernelClient(mock);
  }
  const apiKey = (hosted?.apiKey ?? process.env.CLEARRUN_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error(MISSING_KEY);
  }
  return new HostedApiClient(
    { baseUrl: hosted?.baseUrl, apiKey, timeoutMs: hosted?.timeoutMs },
    deps
  );
}
