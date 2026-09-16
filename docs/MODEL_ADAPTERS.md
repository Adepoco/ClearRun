# ClearRun Model Adapters & Vendor Neutrality

**Public note.** Open adapters live in `@clearrun/vendors` (OpenAI, Anthropic, Google). They are transport only. Honesty scoring runs on the hosted kernel at `https://api.clearrun.net`, independent of vendor.

**Version:** 8.0.0  
**Status:** Canonical (Patch 8)  
**Last Updated:** January 8, 2026

This document defines how ClearRun evaluates AI outputs **independently of the underlying model vendor**.

---

## Core Architectural Principle

> **ClearRun never trusts a model's identity — it verifies behavior.**

Models are treated as **opaque generators**, not authorities.

---

## Model Adapter Interface

Each adapter must expose:

```typescript
interface ModelAdapter {
  model_id: string;
  vendor: string;
  version: string | null;
  invocation_mode: 'chat' | 'completion' | 'tool' | 'wrapped';
  
  invoke(payload: AdapterPayload): Promise<AdapterResponse>;
  getMetadata(): AdapterMetadata;
}

interface AdapterMetadata {
  latency_ms: number;
  token_counts?: { input: number; output: number };
  timestamp: string;
}
```

**Adapters must NOT:**
- Inject safety logic
- Modify content
- Normalize tone

They are **transport only**.

---

## Supported Model Categories

### Commercial APIs
- OpenAI (GPT-4.x, GPT-5.x series)
- Anthropic (Claude Sonnet / Opus series)
- Google (Gemini family)
- xAI (Grok series)
- Mistral (Large series)

### Tool-Wrapped Systems
- IDE copilots
- No-code / low-code builders
- Chat-based orchestration tools

### Self-Hosted / Internal Models
- Fine-tuned LLMs
- Private inference endpoints
- Research models

ClearRun never assumes feature parity.

---

## Model Selection Rules

| Tier | Model Access |
|------|--------------|
| Free | Single default model, no selector |
| Pro | User-selectable via UI dropdown |
| Business | Model pools, per-workspace restrictions |
| Enterprise | Audit logs record model + version per evaluation |

---

## Version Handling (Critical)

**Rules:**
- Version string may be missing or unreliable
- Model signature must be inferred behaviorally
- ClearRun must log:
  - Claimed version
  - Observed behavior signature
  - Adapter version

**If mismatch detected:**
- Flag internally
- Reduce confidence slightly (governance signal)
- Never alert user unless Enterprise / Audit mode

---

## Vendor-Neutral Honesty Invariant

Honesty evaluation must never:
- Rely on vendor-specific safety features
- Trust vendor disclaimers
- Penalize or reward specific providers

> **If two models produce identical text, they must receive identical honesty evaluations.**

---

## Failure & Degraded Modes

**If model metadata unavailable, version unverifiable, or adapter fails partially:**
- Proceed with evaluation
- Mark uncertainty source as "model opacity"
- Slightly widen honesty score range
- Never block user output

---

## API & Data Isolation (Enterprise)

Enterprise deployments may:
- Bind adapters to customer-owned API keys
- Use on-prem or VPC endpoints
- Disable outbound logging entirely

ClearRun must:
- Treat model outputs as customer data
- Never reuse cross-tenant artifacts
- Support adapter sandboxing per tenant

---

## Logging & Audit Requirements

For each evaluated response, log:
- adapter_id
- vendor
- claimed_version
- observed_signature
- evaluation_timestamp
- honesty_state
- score_range (if enabled)

Logs must be immutable in Enterprise mode.

---

**END OF MODEL ADAPTERS**
