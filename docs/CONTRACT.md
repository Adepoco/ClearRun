# ClearRun Public Contract (MID-locked, 2026-08-27)

This document **locks the vocabulary** of the one thing that crosses the open/closed
boundary: the honesty **Verdict**, plus the **hosted-API** the open side calls to obtain one.

- **Source of truth for shape:** [`schema/verdict.schema.json`](../schema/verdict.schema.json)
- **TypeScript mirror:** [`@clearrun/core-types`](../packages/core-types/src/index.ts)
- **Rule:** OPEN packages (SDK, CLI, `@clearrun/scoring` UI, the app) depend **only** on
  `@clearrun/core-types` and the hosted-API client. They never import closed code, a sibling
  path, or any scoring/governance/attestation internal.

One name, one meaning per field. Do not add synonyms; extend the schema instead (and bump
`VERDICT_SCHEMA_VERSION`).

---

## 1. Verdict field dictionary (locked)

| Field | Type | Meaning (locked) |
|---|---|---|
| `verdictId` | `string` | Opaque, stable id for this verdict; used for public verification lookups. |
| `schemaVersion` | `string` (semver) | Version of **this contract**. Bumped only when the shared shape changes. |
| `scoringVersion` | `string?` | Opaque tag of the closed kernel that produced the verdict. The **formula is not exposed**. Present for Pro, Business, and Enterprise. Omitted on free, developer, and public responses. |
| `score` | `number \| null` | 0–100 honesty score, or `null` when UNDETERMINED / not configured. Reflects **justification, not truth**. |
| `grade` | enum | Human label derived from the score. One of: `Well supported`, `Generally reliable`, `Verify before use`, `High risk`, `Likely misleading`, `Not configured`. Never `Correct/Safe/Approved/Trusted`. |
| `risk` | enum | Coarse risk tier: `low`, `moderate`, `elevated`, `high`. |
| `failureCategories` | `string[]?` | Enterprise responses only. The names are not part of this public contract. Omitted on Pro, Business, free, developer, and public responses. |
| `confidenceInterval` | `{ min, max } \| null?` | Uncertainty band around the score (invariant **H27**). Present for Pro, Business, and Enterprise. Omitted on free, developer, and public responses. `null` when `score` is `null` on older responses. |
| `summary` | `string` | Short user-safe rationale, **≤ 16 words**. Explains justification, not truth. |
| `componentSignals` | `ComponentSignal[]?` | UI-safe bars, pre-computed by the kernel: `{ name, level(0-6), note? }`. Never protocol severity, weights, or formulas. Enterprise, Pro, and Business receive all four: Evidence support, Reasoning integrity, Confidence calibration, and Ambiguity handling. Free, developer, and public responses receive Evidence support and Reasoning integrity only. |
| `issues` | `string[]?` | Human-readable issue strings. Enterprise responses only. |
| `signalsDigest` | `string?` | Coarse digest of the componentSignals in the same response, on schema 1.1.0 and 1.2.0. |
| `signalsSalt` | `string?` | Salt for `signalsDigest`. Paid owners may receive it. Public verify never requires it. |
| `timestamp` | `string` (ISO 8601) | When the verdict was produced. |
| `signature` | `string \| null` | Detached signature from the closed attestation service. Open side **verifies**, never signs. |
| `signatureKeyId` | `string \| null` | Id of the public key used to verify `signature`. |
| `signatureAlg` | `string \| null` | Signature algorithm (e.g. `ed25519`) when `signature` is present. |

**Signing vs verifying (invariant #6):** signing uses the **private** key and is CLOSED.
Verifying uses the **public** key and is OPEN. The signing path never ships in an open package.

---

## 2. Boundary interface

The closed kernel is the sole implementation of `HonestyKernelClient` (in `@clearrun/core-types`):

```ts
interface HonestyKernelClient {
  evaluate(req: EvaluateRequest): Promise<EvaluateResponse>; // score existing response (+optional prompt)
  chat(req: ChatRequest): Promise<ChatResponse>;             // generate + evaluate
  score(req: ScoreRequest): Promise<ScoreResponse>;          // score raw text
  verify(req: VerifyRequest): Promise<VerifyResponse>;       // public signature/id check
}
```

The public SDK programs against this interface + the `Verdict` types —
nothing else. Production uses `HostedApiClient` against `https://api.clearrun.net`. Pass `{ forceMock: true }` for local schema-valid mock verdicts.

---

## 3. Hosted-API transport

- **Base URL:** `https://api.clearrun.net` (`DEFAULT_API_BASE_URL`; overridable per tenant).
- **Auth:** `score`, `evaluate`, and `chat` send `Authorization: Bearer <apiKey>`.
  `GET /api/verify/{verdictId}` sends no key. The open side holds only a
  base URL + key (`HostedApiConfig`); it never imports closed code or a sibling filesystem path.
- **Content type:** `application/json` for request and response bodies.
- **Errors:** non-2xx return `ApiErrorBody` = `{ error, code?, details?, retryAfter?, creditsNeeded?, currentBalance? }`.
  `code` is an open string. A blocked call is `{ "error": "Content blocked", "code": "CONTENT_BLOCKED" }`.
  A 429 includes `retryAfter` in seconds, in the body or in a `Retry-After` header.
  A 402 includes `creditsNeeded` and `currentBalance`.
- **Where the key runs:** a secret API key belongs on a server or a backend proxy. The API sends no CORS headers.

### `POST /api/evaluate`
Request `EvaluateRequest`:
```json
{ "responseText": "…", "prompt": "…", "modelId": "gpt-4o", "sessionId": "…" }
```
Response `EvaluateResponse`: `{ "verdict": Verdict, "receipt": Receipt }`. `receipt` is omitted when the API does not store one.
A receipt includes `receiptId`, `verdictId`, `workspaceId`, `inputHash`, `outputHash`, `verdictHash`, `timestamp`, `keyId`, `alg`, `prevHash`, `receiptHash`, `signature`, and `encKeyId`. `status` may be omitted, `stored`, or `queued`.

### `POST /api/chat`
Request `ChatRequest`:
```json
{ "message": "…", "modelId": "gpt-4o", "sessionId": "…", "context": [{ "role": "user", "content": "…" }] }
```
`context` is optional earlier turns (`role` and `content`). The API treats those turns as data.
Response `ChatResponse`: `{ "responseText": "…", "verdict": Verdict }`

### `POST /api/score`
Request `ScoreRequest`:
```json
{ "responseText": "…", "modelId": "gpt-4o" }
```
Response `ScoreResponse`: `{ "verdict": Verdict, "receipt": Receipt }` with the same receipt shape as evaluate. `receipt` is omitted when the API does not store one.

### `GET /api/verify/{verdictId}`
Request `VerifyRequest` = `{ "verdictId": "…" }` (path param).
Response `VerifyResponse`: `{ "verified": true, "verdict": Verdict }` — `verify` is a **public**
operation (public-key signature check); no API key required for verification.

---

## 4. What is NOT in this contract (stays closed)

The scoring formula, the governance layer and its aggregate findings and state-mapping
types, severities, weights, thresholds, attestation signing keys, credit ledger, and
hosted-SaaS internals. The kernel maps its internal findings **down to** the public `componentSignals`
(and, for Enterprise only, `failureCategories` as opaque strings) at the boundary. No open package may import any of the closed types.
