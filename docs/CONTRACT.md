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
| `scoringVersion` | `string` | Opaque tag of the closed kernel that produced the verdict. The **formula is not exposed**. |
| `score` | `number \| null` | 0–100 honesty score, or `null` when UNDETERMINED / not configured. Reflects **justification, not truth**. |
| `grade` | enum | Human label derived from the score. One of: `Well supported`, `Generally reliable`, `Verify before use`, `High risk`, `Likely misleading`, `Not configured`. Never `Correct/Safe/Approved/Trusted`. |
| `risk` | enum | Coarse risk tier: `low`, `moderate`, `elevated`, `high`. |
| `failureCategories` | `FailureCategory[]` | Named failure categories only (no internals): `overconfidence`, `unjustified_assertion`, `internal_inconsistency`, `ambiguity_suppression`, `confidence_domain_mismatch`, `unilateral_assertion`, `scope_drift`, `fabrication_risk`. |
| `confidenceInterval` | `{ min, max } \| null` | Uncertainty band around the score (invariant **H27**). `null` when `score` is `null`. |
| `summary` | `string` | Short user-safe rationale, **≤ 16 words**. Explains justification, not truth. |
| `componentSignals` | `ComponentSignal[]?` | Optional UI-safe bars, **pre-computed by the kernel**: `{ name, level(0-6), note? }`. Never protocol severity/weights/formulas. |
| `issues` | `string[]?` | Optional human-readable issue strings for end users. |
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
- **Auth:** scoped API key sent as `Authorization: Bearer <apiKey>`. The open side holds only a
  base URL + key (`HostedApiConfig`); it never imports closed code or a sibling filesystem path.
- **Content type:** `application/json` for request and response bodies.
- **Errors:** non-2xx return `ApiErrorBody` = `{ error, code?, details? }`.

### `POST /api/evaluate`
Request `EvaluateRequest`:
```json
{ "responseText": "…", "prompt": "…", "modelId": "gpt-4o", "sessionId": "…" }
```
Response `EvaluateResponse`: `{ "verdict": Verdict }`

### `POST /api/chat`
Request `ChatRequest`:
```json
{ "message": "…", "modelId": "gpt-4o", "sessionId": "…" }
```
Response `ChatResponse`: `{ "responseText": "…", "verdict": Verdict }`

### `POST /api/score`
Request `ScoreRequest`:
```json
{ "responseText": "…", "modelId": "gpt-4o" }
```
Response `ScoreResponse`: `{ "verdict": Verdict }`

### `GET /api/verify/{verdictId}`
Request `VerifyRequest` = `{ "verdictId": "…" }` (path param).
Response `VerifyResponse`: `{ "verified": true, "verdict": Verdict }` — `verify` is a **public**
operation (public-key signature check); no API key required for verification.

---

## 4. What is NOT in this contract (stays closed)

The scoring formula, the governance layer and its aggregate findings and state-mapping
types, severities, weights, thresholds, attestation signing keys, credit ledger, and
hosted-SaaS internals. The kernel maps its internal findings **down to** `failureCategories`
+ `componentSignals` at the boundary. No open package may import any of the closed types.
