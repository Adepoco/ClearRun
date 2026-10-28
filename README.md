# ClearRun

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

You get a 0 to 100 score, a grade, named failure categories, a short summary, and a signed verdict you can look up again. The open packages in this repo are the client. The scoring engine runs as a hosted service at `https://api.clearrun.net`. It is not in this repository, and these docs do not describe its formula.

Calibrated for English. Scores on other languages are outside the current validated scope.

## Why use it

Use ClearRun when an answer will be shown to a customer, checked into a review, or used for a decision. It flags answers that sound surer than their reasoning supports, and it leaves a record someone else can verify. It does not block or rewrite the answer.

Three ways to call it:

| Package | Version | Use it when |
| --- | --- | --- |
| [`@clearrun/sdk`](packages/sdk/README.md) | 0.1.1 | Your own app or service should call the API. |
| [`@clearrun/cli`](packages/cli/README.md) | 0.1.1 | You want a terminal command or a CI check. |
| [`@clearrun/mcp`](packages/mcp/README.md) | 0.1.1 | Claude Desktop, Claude Code, Cursor, or VS Code should call the tools. |

`@clearrun/core-types` is 0.1.0. The SDK depends on it. One page for all three clients: [docs/developers.md](docs/developers.md).

## Access

An API key is required for hosted scoring. Keys are a Pro plan or higher feature. Create one while signed in at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). A free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

Set the environment variable `CLEARRUN_API_KEY`. Do not commit a real key.

## Install

```bash
npm install @clearrun/sdk
npm install -g @clearrun/cli
npx -y @clearrun/mcp
```

To work from a clone:

```bash
git clone https://github.com/Adepoco/ClearRun.git
cd ClearRun
npm install
```

Node.js 18 or newer. Tag `v0.1.0-oss` is an earlier snapshot. The npm versions above are the current published clients.

## Quickstart

SDK:

```ts
import { createKernelClient } from '@clearrun/sdk';

const client = createKernelClient({
  hosted: { apiKey: process.env.CLEARRUN_API_KEY },
});

const { verdict } = await client.evaluate({
  prompt: 'Where is the Eiffel Tower?',
  responseText: 'The Eiffel Tower is in Berlin.',
});

console.log(verdict.score, verdict.grade, verdict.failureCategories);
```

CLI:

```bash
export CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY
clearrun verify --text "The Eiffel Tower is in Berlin."
```

No API key for local development? Pass `{ forceMock: true }` to the SDK. The mock returns schema-valid verdicts, never real scores. The MCP server never uses the mock.

MCP hosts use the copy-paste blocks in [packages/mcp/README.md](packages/mcp/README.md). Each one runs `npx -y @clearrun/mcp` with `CLEARRUN_API_KEY` in `env`. Cursor's project file is `.cursor/mcp.json`.

## Tools and commands

SDK methods and MCP tools:

| Call | What it does |
| --- | --- |
| `score` / `clearrun_score` | Score text that was already written (`POST /api/score`). |
| `evaluate` / `clearrun_evaluate` | Score an existing answer, with the prompt when you have it (`POST /api/evaluate`). |
| `chat` / `clearrun_chat` | Ask the hosted API to generate an answer and score it (`POST /api/chat`). |
| `verify` / `clearrun_verify` | Look up a verdict id (`GET /api/verify/{id}`). |

CLI (this command scores text; it does not look up a verdict id):

```bash
clearrun verify answer.txt
clearrun verify --text "The capital of France is Paris." --json
clearrun verify --config ci/clearrun.config.json --threshold 75
```

Short examples for each client are in the package READMEs and in [docs/developers.md](docs/developers.md).

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 26 credits per turn. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Verify a verdict

A hosted verdict id can be checked again with no account:

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

The lookup confirms the stored verdict. It does not fact-check the original answer.

## What you get back

A `Verdict` (see `schema/verdict.schema.json` and [docs/CONTRACT.md](docs/CONTRACT.md)): `score` (0 to 100, or null when the API cannot score), `grade`, `risk`, `failureCategories`, `confidenceInterval`, `summary`, and an Ed25519 `signature` you can verify locally or with `GET https://api.clearrun.net/api/verify/{verdictId}`.

Grades are `Well supported`, `Generally reliable`, `Verify before use`, `High risk`, `Likely misleading`, and `Not configured`. They are not labels of factual truth.

## Open core

MIT in this repo: the SDK, model adapters (OpenAI, Anthropic, Google), CLI, MCP server, verdict types, and schema. Clone it, embed it, build on it.

The scoring kernel is hosted and closed. It provides honesty scoring and signed attestation. The SDK calls it. The scoring logic is not in this repo by design. The hosted kernel is licensed separately (BSL-1.1). See `LICENSE`.

## Links

- npm SDK: [https://www.npmjs.com/package/@clearrun/sdk](https://www.npmjs.com/package/@clearrun/sdk)
- npm CLI: [https://www.npmjs.com/package/@clearrun/cli](https://www.npmjs.com/package/@clearrun/cli)
- npm MCP: [https://www.npmjs.com/package/@clearrun/mcp](https://www.npmjs.com/package/@clearrun/mcp)
- npm types: [https://www.npmjs.com/package/@clearrun/core-types](https://www.npmjs.com/package/@clearrun/core-types)
- GitHub: [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun)
- Site: [https://clearrun.net](https://clearrun.net)
- Pricing: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)
- API keys: [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)
- Developer guide: [docs/developers.md](docs/developers.md)
- Directory checklist: [docs/LISTINGS.md](docs/LISTINGS.md)

ClearRun is made by Adepoco, a California corporation. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).
