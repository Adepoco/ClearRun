// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// HostedApiClient: the production implementation of HonestyKernelClient. It
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
import { MissingApiKeyError } from './credentials';

/**
 * Minimal fetch signature for Node 18+ and tests.
 * A secret API key belongs on a server or a backend proxy.
 * The hosted API sends no CORS headers.
 */
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
  headers?: { get?(name: string): string | null };
  json(): Promise<unknown>;
}>;

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function headerValue(headers: { get?(name: string): string | null } | undefined, name: string): string | undefined {
  if (!headers || typeof headers.get !== 'function') return undefined;
  const value = headers.get(name);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Seconds until retry. Body `retryAfter` wins. Otherwise the Retry-After header. */
function retryAfterSeconds(body: ApiErrorBody, headers: { get?(name: string): string | null } | undefined): number | undefined {
  const fromBody = finiteNumber(body.retryAfter);
  if (fromBody !== undefined && fromBody >= 0) return fromBody;
  const raw = headerValue(headers, 'retry-after');
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const delta = Number(trimmed);
    return Number.isFinite(delta) && delta >= 0 ? delta : undefined;
  }
  const when = Date.parse(trimmed);
  if (Number.isNaN(when)) return undefined;
  return Math.max(0, Math.ceil((when - Date.now()) / 1000));
}

export class HostedApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  /** Seconds to wait. Set on 429, from the body or the Retry-After header. */
  readonly retryAfter?: number;
  /** Credits the refused call required. Set on 402, from the body. */
  readonly creditsNeeded?: number;
  /** Balance reported with a 402, from the body. */
  readonly currentBalance?: number;

  constructor(
    status: number,
    body: ApiErrorBody,
    headers?: { get?(name: string): string | null }
  ) {
    super(body?.error || `ClearRun API error ${status}`);
    this.name = 'HostedApiError';
    this.status = status;
    this.code = body?.code;
    this.details = body?.details;
    if (status === 429) {
      const retryAfter = retryAfterSeconds(body ?? { error: '' }, headers);
      if (retryAfter !== undefined) this.retryAfter = retryAfter;
    }
    if (status === 402 && body) {
      const creditsNeeded = finiteNumber(body.creditsNeeded);
      const currentBalance = finiteNumber(body.currentBalance);
      if (creditsNeeded !== undefined) this.creditsNeeded = creditsNeeded;
      if (currentBalance !== undefined) this.currentBalance = currentBalance;
    }
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
    this.apiKey = config.apiKey ?? '';
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

  /** score, evaluate, and chat spend a hosted call and require a key. verify does not. */
  private assertCanScore(): void {
    if (!this.apiKey.trim()) {
      throw new MissingApiKeyError();
    }
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
        const body =
          data && typeof data === 'object' ? (data as ApiErrorBody) : { error: 'Unknown error' };
        throw new HostedApiError(res.status, body, res.headers);
      }
      return data as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async evaluate(req: EvaluateRequest): Promise<EvaluateResponse> {
    this.assertCanScore();
    return this.request<EvaluateResponse>('POST', '/api/evaluate', req);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.assertCanScore();
    const data = await this.request<ChatResponse & { response?: unknown }>('POST', '/api/chat', req);
    // The documented field is responseText (docs/CONTRACT.md). The hosted API
    // returned the generated answer only as `response` until it was fixed, so
    // accept either and always hand callers responseText.
    if (typeof data.responseText !== 'string' && typeof data.response === 'string') {
      return { ...data, responseText: data.response };
    }
    return data;
  }

  async score(req: ScoreRequest): Promise<ScoreResponse> {
    this.assertCanScore();
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
