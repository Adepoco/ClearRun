# ClearRun

Honesty scoring for AI responses. ClearRun evaluates any AI output and returns a plain-language **honesty verdict** — a score, a reliability state, a failure breakdown, and a signed, verifiable record — through a small open SDK, model adapters, and a CLI.

> **What ClearRun measures:** confidence-justification **alignment** — whether an AI's expressed confidence is backed by its reasoning. **It does not fact-check.** A high score means the response's confidence matches its justification, *not* that it is factually true. Verified factual accuracy is on the roadmap.

## Install

Packages are **not on the npm registry yet.** Clone this repo and install the workspace (SDK, CLI, adapters, types):

```bash
git clone https://github.com/adepoco/clearrun.git
cd clearrun
npm install
```

Then import `@clearrun/sdk` from the workspace. After `npm publish` of `@clearrun/sdk`, the install line will be `npm install @clearrun/sdk`. Until then, **GitHub clone is the supported path.**

If this repository lives at a different URL, clone that URL instead — tag `v0.1.0-oss` is the release snapshot.

## Quickstart
```ts
import { createKernelClient } from '@clearrun/sdk';

const client = createKernelClient({
  hosted: { apiKey: process.env.CLEARRUN_API_KEY }, // required; get a beta key at api.clearrun.net
});

const { verdict } = await client.evaluate({
  responseText: 'The Eiffel Tower is in Berlin.',
});

console.log(verdict.score, verdict.grade, verdict.failureCategories);
```
No API key configured? Pass `{ forceMock: true }` for local development — the mock returns schema-valid verdicts, never real scores.

## What you get back
A `Verdict` (see `schema/verdict.schema.json` and `docs/CONTRACT.md`): `score` (0–100), `grade`, `risk`, `failureCategories[]`, `confidenceInterval`, `componentSignals[]`, plain-language `summary`, and an Ed25519 `signature` you can verify — locally or via `GET https://api.clearrun.net/api/verify/{verdictId}`.

## Open core
- **MIT (this repo):** the SDK, model adapters (OpenAI, Anthropic, Google), CLI, verdict types, and schema. Clone it, embed it, build on it.
- **Hosted, closed (beta):** the scoring kernel — governance protocols, honesty scoring, and signed attestation — runs as a hosted service at `api.clearrun.net`. The SDK calls it; the scoring logic is not in this repo by design.

## Roadmap
- Now: confidence-justification alignment scoring (this release).
- Next: verified factual-accuracy layer, richer audit, and enterprise governance exports.

## License
MIT for everything in this repository. The hosted scoring kernel is licensed separately (BSL-1.1). See `LICENSE`.
