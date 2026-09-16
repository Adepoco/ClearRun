// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// @clearrun/core-types — the ONLY contract that crosses the open/closed boundary.
//
// Contents:
//   1. Verdict Format .......... the shared honesty verdict (mirrors schema/verdict.schema.json)
//   2. UI display types ........ presentational shapes derived from a Verdict (used by @clearrun/scoring)
//   3. Boundary interface ...... HonestyKernelClient — what the closed kernel implements
//   4. Hosted-API contract ..... request/response + transport config for evaluate/chat/score/verify
//
// INVARIANTS:
//   - No scoring formula, protocol logic, or key material lives here. Types only.
//   - OPEN packages (SDK, CLI, scoring-ui, app) depend ONLY on this module + the hosted-API client.
//   - The closed kernel maps its internal findings → these public types at the boundary.

// ============================================================================
// 1. VERDICT FORMAT (locked vocabulary — see docs/CONTRACT.md)
// ============================================================================

/** Version of the shared verdict contract. Keep in sync with schema/verdict.schema.json. */
export const VERDICT_SCHEMA_VERSION = '1.0.0';

/** Human-facing band label derived from the score. Never uses Correct/Safe/Approved/Trusted. */
export type VerdictGrade =
  | 'Well supported'
  | 'Generally reliable'
  | 'Verify before use'
  | 'High risk'
  | 'Likely misleading'
  | 'Not configured';

/** Coarse risk tier for the evaluated response. */
export type VerdictRisk = 'low' | 'moderate' | 'elevated' | 'high';

/** Named categories of detected honesty failures (names only — no internals, weights, thresholds). */
export type FailureCategory =
  | 'overconfidence'
  | 'unjustified_assertion'
  | 'internal_inconsistency'
  | 'ambiguity_suppression'
  | 'confidence_domain_mismatch'
  | 'unilateral_assertion'
  | 'scope_drift'
  | 'fabrication_risk';

/** Uncertainty band around the score (invariant H27: scores must carry uncertainty bands). */
export interface ConfidenceInterval {
  min: number;
  max: number;
}

/**
 * A single UI-safe component signal, pre-computed by the closed kernel.
 * Carries only a display level (0-6) and a short note — never the underlying
 * protocol severity, weight, or formula. Lets the open UI render component bars
 * without any access to governance internals.
 */
export interface ComponentSignal {
  /** Display name, e.g. "Evidence support", "Reasoning integrity". */
  name: string;
  /** Bar level 0-6 (6 = strongest). Already derived by the kernel; UI-safe. */
  level: number;
  /** Short public description of this component's state. */
  note?: string;
}

/**
 * ClearRun Honesty Verdict — the single object that crosses the open/closed
 * boundary. Produced by the closed kernel, consumed by open packages.
 */
export interface Verdict {
  verdictId: string;
  schemaVersion: string;
  /** Opaque version tag of the closed scoring kernel. The formula is not exposed. */
  scoringVersion: string;
  /** 0-100, or null when UNDETERMINED / not configured. Reflects justification, not truth. */
  score: number | null;
  grade: VerdictGrade;
  risk: VerdictRisk;
  failureCategories: FailureCategory[];
  confidenceInterval: ConfidenceInterval | null;
  /** Short user-safe rationale (<= 16 words). */
  summary: string;
  /** Optional UI-safe component signals for rendering bars (kernel-provided). */
  componentSignals?: ComponentSignal[];
  /** Optional human-readable issue strings for end users. */
  issues?: string[];
  /** ISO 8601 timestamp of when the verdict was produced. */
  timestamp: string;
  /** Detached signature from the closed attestation service (open side only VERIFIES). */
  signature?: string | null;
  signatureKeyId?: string | null;
  signatureAlg?: string | null;
}

/** Runtime guard: is a value shaped like a Verdict? Structural check only. */
export function isVerdict(value: unknown): value is Verdict {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.verdictId === 'string' &&
    typeof v.schemaVersion === 'string' &&
    typeof v.scoringVersion === 'string' &&
    (typeof v.score === 'number' || v.score === null) &&
    typeof v.grade === 'string' &&
    typeof v.risk === 'string' &&
    Array.isArray(v.failureCategories) &&
    typeof v.summary === 'string' &&
    typeof v.timestamp === 'string'
  );
}

// ============================================================================
// 2. UI DISPLAY TYPES (consumed by @clearrun/scoring ui-mapper — presentational only)
// ============================================================================

/** A rendered component bar for the expanded "why" panel. */
export interface ComponentIndicator {
  name: string;
  /** Bar level 0-6. */
  level: number;
  description: string;
}

/** UI-safe projection of a Verdict. Never shows a number alone; always paired with a label. */
export interface VerdictDisplay {
  score: number | null;
  label: VerdictGrade;
  shortReason: string;
  componentIndicators?: ComponentIndicator[];
}

// ============================================================================
// 3. BOUNDARY INTERFACE (the closed kernel implements this; open side depends on it)
// ============================================================================

/**
 * The exact surface crossing the open/closed boundary. The public SDK and the
 * ClearRun app depend ONLY on this interface + the Verdict types above. The
 * closed kernel (hosted API) is the sole implementation. Nothing here exposes
 * scoring, governance, or attestation internals.
 */
export interface HonestyKernelClient {
  /** Evaluate a model response (optionally with the prompt that produced it). */
  evaluate(req: EvaluateRequest): Promise<EvaluateResponse>;
  /** Generate a response AND evaluate it in one call. */
  chat(req: ChatRequest): Promise<ChatResponse>;
  /** Score already-produced text (no generation). */
  score(req: ScoreRequest): Promise<ScoreResponse>;
  /** Verify a previously issued verdict by id (public signature check). */
  verify(req: VerifyRequest): Promise<VerifyResponse>;
}

// ============================================================================
// 4. HOSTED-API CONTRACT (transport — see docs/CONTRACT.md for the wire format)
// ============================================================================

/** Default hosted kernel base URL. Overridable for self-hosted/enterprise tenants. */
export const DEFAULT_API_BASE_URL = 'https://api.clearrun.net';

/**
 * Transport configuration for reaching the hosted kernel. The open side NEVER
 * imports closed code or a sibling path — it only holds a base URL + a scoped
 * API key, sent as `Authorization: Bearer <apiKey>`.
 */
export interface HostedApiConfig {
  /** Defaults to DEFAULT_API_BASE_URL. */
  baseUrl?: string;
  /** Scoped API key. Sent as the Bearer token. Required for all non-public routes. */
  apiKey: string;
  /** Optional request timeout in milliseconds. */
  timeoutMs?: number;
}

// ── Requests ────────────────────────────────────────────────────────────────

export interface EvaluateRequest {
  responseText: string;
  /** The prompt that produced responseText, if available (improves calibration). */
  prompt?: string;
  /** Opaque model identifier (see @clearrun/vendors registry). */
  modelId?: string;
  sessionId?: string;
}

export interface ChatRequest {
  message: string;
  modelId?: string;
  sessionId?: string;
}

export interface ScoreRequest {
  responseText: string;
  modelId?: string;
}

export interface VerifyRequest {
  verdictId: string;
}

// ── Responses ─────────────────────────────────────────────────────────────

export interface EvaluateResponse {
  verdict: Verdict;
}

export interface ScoreResponse {
  verdict: Verdict;
}

export interface ChatResponse {
  responseText: string;
  verdict: Verdict;
}

export interface VerifyResponse {
  verified: boolean;
  /** Present when the verdict id resolves. */
  verdict?: Verdict;
}

/** Standard error envelope returned by the hosted API on non-2xx responses. */
export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}
