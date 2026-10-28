# ClearRun

Honesty scoring for AI responses. ClearRun evaluates any AI output and returns a plain-language **honesty verdict** through a small open SDK, model adapters, and a CLI. A verdict includes a score, a grade, a failure breakdown, and a signed, verifiable record.

> **What ClearRun measures:** confidence-justification **alignment**, whether an AI's expressed confidence is backed by its reasoning. **It does not fact-check.** A high score means the response's confidence matches its justification, *not* that it is factually true. Verified factual accuracy is on the roadmap.

## Install

All six `@clearrun` packages are on the npm registry. `@clearrun/sdk` and `@clearrun/cli` are at **0.1.1**; `@clearrun/core-types`, `@clearrun/scoring`, `@clearrun/security` and `@clearrun/vendors` are at **0.1.0**. See `CHANGELOG.md` for what changed in 0.1.1.

```bash
npm install @clearrun/core-types @clearrun/sdk @clearrun/scoring @clearrun/security @clearrun/vendors
npm install -g @clearrun/cli
```

To work from a clone of this repository instead:

```bash
git clone https://github.com/adepoco/clearrun.git
cd clearrun
npm install
```

Then import `@clearrun/sdk` from the workspace.

If this repository lives at a different URL, clone that URL instead. Tag `v0.1.0-oss` is the release snapshot.

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
No API key configured? Pass `{ forceMock: true }` for local development. The mock returns schema-valid verdicts, never real scores.

## MCP server

`@clearrun/mcp` is version **0.1.1** in this repo. It depends on `@clearrun/sdk` ^0.1.1 and `@clearrun/core-types` ^0.1.0. It is a stdio server for Claude Desktop, Cursor, and other MCP hosts. It calls `https://api.clearrun.net` through `createKernelClient` / `HostedApiClient`. It does not score on its own, and it never falls back to the mock client.

ClearRun scores honesty (whether an answer's confidence is backed by its reasoning). It is not a fact-checker.

### Install

```bash
npm install @clearrun/mcp
```

From a clone of this repository:

```bash
npm install
npm run build -w @clearrun/mcp
node packages/mcp/dist/index.js
```

Publishing `@clearrun/mcp` to npm is a separate step.

### Claude Desktop and Cursor

Use the same entry in Claude Desktop (`claude_desktop_config.json`) and Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`). Set `CLEARRUN_API_KEY` to your own key. API keys are a Pro feature, created at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys).

```json
{
  "mcpServers": {
    "clearrun": {
      "command": "npx",
      "args": ["-y", "@clearrun/mcp"],
      "env": {
        "CLEARRUN_API_KEY": "YOUR_CLEARRUN_API_KEY"
      }
    }
  }
}
```

From a clone, set `command` to `node` and `args` to the absolute path of `packages/mcp/dist/index.js`.

### Tools

| Tool | What it does |
| --- | --- |
| `clearrun_score` | Score text that was already written. |
| `clearrun_evaluate` | Score an existing answer, with the prompt when you have it. |
| `clearrun_chat` | Ask the hosted API to generate an answer and score it. |
| `clearrun_verify` | Look up a verdict id on the public verification endpoint. |

Each tool returns the score, the verdict, and the scoring version when the API includes them. A receipt is included only when the API sends one. None of these tools fact-check the answer. With no API key, every tool returns an error instead of a score. See `packages/mcp/README.md`.

## What you get back
A `Verdict` (see `schema/verdict.schema.json` and `docs/CONTRACT.md`): `score` (0-100), `grade`, `risk`, `failureCategories[]`, `confidenceInterval`, `componentSignals[]`, plain-language `summary`, and an Ed25519 `signature` you can verify locally, or via `GET https://api.clearrun.net/api/verify/{verdictId}`.

## Open core
- **MIT (this repo):** the SDK, model adapters (OpenAI, Anthropic, Google), CLI, verdict types, and schema. Clone it, embed it, build on it.
- **Hosted, closed (beta):** the scoring kernel runs as a hosted service at `api.clearrun.net`. It provides governance protocols, honesty scoring, and signed attestation. The SDK calls it; the scoring logic is not in this repo by design.

## Roadmap
- Now: confidence-justification alignment scoring (this release). Calibrated for English; scores on non-English output are outside today's validated scope.
- Next: multilingual scoring (language-specific confidence and hedging cues), a verified factual-accuracy layer, richer audit, and enterprise governance exports.

## License
MIT for everything in this repository. The hosted scoring kernel is licensed separately (BSL-1.1). See `LICENSE`.
