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

/** Version of the hosted response contract. Legacy receipts remain 1.0.0 and 1.1.0. Keep in sync with schema/verdict.schema.json. */
export const VERDICT_SCHEMA_VERSION = '1.2.0';

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
  /**
   * Opaque version tag of the closed scoring kernel. Present for Pro,
   * Business, and Enterprise. Omitted on free, developer, and public
   * responses. The formula is not exposed.
   */
  scoringVersion?: string;
  /** 0-100, or null when UNDETERMINED / not configured. Reflects justification, not truth. */
  score: number | null;
  grade: VerdictGrade;
  risk: VerdictRisk;
  /** Enterprise responses only. The names are not part of this package. */
  failureCategories?: string[];
  /** Pro, Business, and Enterprise. Omitted on free, developer, and public responses. Null when score is null on older responses. */
  confidenceInterval?: ConfidenceInterval | null;
  /** Short user-safe rationale (<= 16 words). */
  summary: string;
  /**
   * UI-safe component signals. Enterprise, Pro, and Business receive all four:
   * Evidence support, Reasoning integrity, Confidence calibration, and
   * Ambiguity handling. Free, developer, and public responses receive
   * Evidence support and Reasoning integrity only.
   */
  componentSignals?: ComponentSignal[];
  /** Human-readable issue strings. Enterprise responses only. */
  issues?: string[];
  /** ISO 8601 timestamp of when the verdict was produced. */
  timestamp?: string;
  /** Detached signature from the closed attestation service (open side only VERIFIES). */
  signature?: string | null;
  signatureKeyId?: string | null;
  signatureAlg?: string | null;
  /** Coarse digest of the componentSignals in this response. Present on schema 1.1.0 and 1.2.0. */
  signalsDigest?: string;
  /**
   * Salt for signalsDigest. Paid owners receive it. Public verify must not require it.
   */
  signalsSalt?: string;
  inputHash?: string;
  outputHash?: string;
  verdictHash?: string;
}

function absentOr(value: unknown, ok: boolean): boolean {
  return value === undefined || ok;
}

/** Runtime guard: is a value shaped like a Verdict? A missing optional field is not a failure. */
export function isVerdict(value: unknown): value is Verdict {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const intervalOk =
    v.confidenceInterval === null ||
    (typeof v.confidenceInterval === 'object' &&
      v.confidenceInterval !== null &&
      typeof (v.confidenceInterval as { min?: unknown }).min === 'number' &&
      typeof (v.confidenceInterval as { max?: unknown }).max === 'number');
  return (
    typeof v.verdictId === 'string' &&
    typeof v.schemaVersion === 'string' &&
    (typeof v.score === 'number' || v.score === null) &&
    typeof v.grade === 'string' &&
    typeof v.risk === 'string' &&
    typeof v.summary === 'string' &&
    absentOr(v.scoringVersion, typeof v.scoringVersion === 'string') &&
    absentOr(v.failureCategories, Array.isArray(v.failureCategories)) &&
    absentOr(v.confidenceInterval, intervalOk) &&
    absentOr(v.componentSignals, Array.isArray(v.componentSignals)) &&
    absentOr(v.issues, Array.isArray(v.issues)) &&
    absentOr(v.timestamp, typeof v.timestamp === 'string') &&
    absentOr(v.signalsDigest, typeof v.signalsDigest === 'string') &&
    absentOr(v.signalsSalt, typeof v.signalsSalt === 'string') &&
    absentOr(v.signature, typeof v.signature === 'string' || v.signature === null)
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

/** One earlier chat turn. The hosted API treats this as data, not a new instruction. */
export interface ChatContextTurn {
  role: string;
  content: string;
}

export interface ChatRequest {
  message: string;
  modelId?: string;
  sessionId?: string;
  /** Earlier turns, when the caller has them. */
  context?: ChatContextTurn[];
}

export interface ScoreRequest {
  responseText: string;
  modelId?: string;
}

export interface VerifyRequest {
  verdictId: string;
}

// ── Responses ─────────────────────────────────────────────────────────────

/**
 * Receipt stored with a hosted scoring call.
 * `status` may be omitted, `stored`, or `queued`.
 */
export interface Receipt {
  receiptId: string;
  verdictId: string;
  workspaceId: string;
  inputHash: string;
  outputHash: string;
  verdictHash: string;
  timestamp: string;
  keyId: string;
  alg: string;
  prevHash: string;
  receiptHash: string;
  signature: string;
  encKeyId: string;
  status?: 'stored' | 'queued';
}

export interface EvaluateResponse {
  verdict: Verdict;
  /** Present when the hosted API stores a receipt for this call. */
  receipt?: Receipt;
}

export interface ScoreResponse {
  verdict: Verdict;
  /** Present when the hosted API stores a receipt for this call. */
  receipt?: Receipt;
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

/**
 * Standard error envelope returned by the hosted API on non-2xx responses.
 * `code` is an open string, not a closed union. One value the API sends is
 * `CONTENT_BLOCKED`, with `error` set to `Content blocked`.
 * A 429 may include `retryAfter` (seconds). A 402 may include `creditsNeeded`
 * and `currentBalance`.
 */
export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
  creditsNeeded?: number;
  currentBalance?: number;
}
