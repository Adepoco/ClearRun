// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// HostedApiClient — the production implementation of HonestyKernelClient. It
// reaches the CLOSED kernel ONLY over the hosted API (docs/CONTRACT.md): base
// URL + a scoped API key sent as `Authorization: Bearer <apiKey>`. It never
// imports closed code or a sibling filesystem path.

import {
  DEFAULT_API_BASE_URL,
  type HonestyKernelClient,
  type HostedApiConfig,
  type EvaluateRequest,
  type EvaluateResponse,
  type ChatRequest,
  type ChatResponse,
  type ScoreRequest,
  type ScoreResponse,
  type VerifyRequest,
  type VerifyResponse,
  type ApiErrorBody,
} from '@clearrun/core-types';

/** Minimal fetch signature so the client works in Node 18+, browsers, and tests. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class HostedApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, body: ApiErrorBody) {
    super(body.error || `ClearRun API error ${status}`);
    this.name = 'HostedApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export interface HostedClientDeps {
  /** Injectable fetch (defaults to global fetch). Used for testing. */
  fetch?: FetchLike;
}

export class HostedApiClient implements HonestyKernelClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs?: number;
  private fetchImpl: FetchLike;

  constructor(config: HostedApiConfig, deps: HostedClientDeps = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs;
    const g = deps.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (!g) {
      throw new Error('No fetch implementation available; pass one via deps.fetch');
    }
    this.fetchImpl = g;
  }

  private authHeaders(includeAuth: boolean): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (includeAuth && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    includeAuth = true
  ): Promise<T> {
    let signal: AbortSignal | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (this.timeoutMs && typeof AbortController !== 'undefined') {
      const ctrl = new AbortController();
      signal = ctrl.signal;
      timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.authHeaders(includeAuth),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        throw new HostedApiError(res.status, (data as ApiErrorBody) ?? { error: 'Unknown error' });
      }
      return data as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  evaluate(req: EvaluateRequest): Promise<EvaluateResponse> {
    return this.request<EvaluateResponse>('POST', '/api/evaluate', req);
  }

  chat(req: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('POST', '/api/chat', req);
  }

  score(req: ScoreRequest): Promise<ScoreResponse> {
    return this.request<ScoreResponse>('POST', '/api/score', req);
  }

  verify(req: VerifyRequest): Promise<VerifyResponse> {
    // Verification is a PUBLIC operation (public-key signature check); no key required.
    return this.request<VerifyResponse>(
      'GET',
      `/api/verify/${encodeURIComponent(req.verdictId)}`,
      undefined,
      false
    );
  }
}
