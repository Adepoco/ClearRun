# ClearRun for developers

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

This page is the adoption guide for the three public clients. It is written so it can later live at `clearrun.net/developers`.

The clients call the hosted API at `https://api.clearrun.net`. They do not contain the scoring engine, its weights, or its formula. Source: [github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun).

## Why use it

Put a check on answers your product will show, store, or act on. ClearRun reports when the confidence in an answer outruns the reasoning in that answer. You get a score, a grade, named failure categories, and a signed verdict another person can open later. ClearRun does not block, rewrite, or approve the answer.

Pick one client:

| You are building | Package | Version |
| --- | --- | --- |
| An app, script, or service | [`@clearrun/sdk`](https://www.npmjs.com/package/@clearrun/sdk) | 0.3.0 |
| A terminal or CI check | [`@clearrun/cli`](https://www.npmjs.com/package/@clearrun/cli) | 0.3.0 |
| A tool inside Claude, Cursor, or VS Code | [`@clearrun/mcp`](https://www.npmjs.com/package/@clearrun/mcp) | 0.3.0 |

Shared types are [`@clearrun/core-types`](https://www.npmjs.com/package/@clearrun/core-types) 0.1.0. Node.js 18 or newer.

The Version column is this repository. npm still serves 0.2.0, published 2026-10-29, until a maintainer publishes 0.3.0. Breaking change from 0.2.0: `clearrun verify --text` no longer scores. Use `clearrun score`. `clearrun verify <verdictId>` is a lookup and does not need an API key. On npm 0.2.0, `clearrun verify <file>` scores text, the CLI exports a scoring `verify()`, the SDK does not export `createVerifyClient()`, and MCP verify still requires a key. The commands below match 0.3.0.

## Get an API key

Hosted scoring needs a ClearRun account, API access, and an API key. API access is a saved setting on Pro and higher. Turning it off stops API keys from working. The free plan includes 30 monthly credits and does not include API access, so a free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

ClearRun does not use your content to train third-party or generation models. Whether your evaluations may help improve ClearRun's own scoring is an account setting: free plans start opted in, paid plans start opted out, and Enterprise stays off.

1. Open [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). Sign in on that page if you need an account. That page is where you create a key.
2. Save the key:

```bash
npx @clearrun/cli login
```

Or set `CLEARRUN_API_KEY`. Do not commit a real key.

Lookup order for the SDK and the MCP server: an explicit key, then `CLEARRUN_API_KEY`, then `~/.config/clearrun/config.json` from `clearrun login`. The CLI checks `--api-key` first, then that same order, then `apiKey` in `./clearrun.config.json`.

Without a key, `createKernelClient()` throws `MissingApiKeyError`. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` return that same message, and the server logs it to stderr at startup. `createVerifyClient()` and `clearrun_verify` look up a verdict id with no key. Pass `{ forceMock: true }` only for local SDK development. The mock returns schema-valid verdicts for local development. The CLI and the MCP server do not offer that mock.

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 1 credit per turn.

[https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)

Those two sentences are the per-call costs on that page. If the page changes, the page is the source for those costs. The free plan's 30 monthly credits are an allowance, not a per-call price. `clearrun score` calls score, so each file or `--text` input costs at least 3 credits. `clearrun verify` spends no credits.

## SDK

```bash
npm install @clearrun/sdk
```

`npm install @clearrun/sdk` still installs 0.2.0 until 0.3.0 is published. 0.2.0 has `score`, `evaluate`, `chat`, and `client.verify`. `createVerifyClient()` is in 0.3.0.

```ts
import { createKernelClient } from '@clearrun/sdk';

const client = createKernelClient({
  hosted: { apiKey: process.env.CLEARRUN_API_KEY },
});

const scored = await client.score({
  responseText: 'The Eiffel Tower is in Berlin.',
});

const evaluated = await client.evaluate({
  prompt: 'Where is the Eiffel Tower?',
  responseText: 'The Eiffel Tower is in Berlin.',
});

const chat = await client.chat({
  message: 'What is the capital of France?',
});

const check = await client.verify({
  verdictId: scored.verdict.verdictId,
});

console.log(scored.verdict.score, chat.responseText, check.verified);
```

| Method | HTTP | What you send |
| --- | --- | --- |
| `score` | `POST /api/score` | `responseText`, optional `modelId` |
| `evaluate` | `POST /api/evaluate` | `responseText`, optional `prompt`, `modelId`, `sessionId` |
| `chat` | `POST /api/chat` | `message`, optional `modelId`, `sessionId` |
| `verify` | `GET /api/verify/{verdictId}` | `verdictId` |

Auth on score, evaluate, and chat is `Authorization: Bearer <apiKey>`. `verify` does not send the key. `createKernelClient()` still requires a key for scoring, unless you opted into the mock. `createVerifyClient()` looks up a verdict id with no key. A non-2xx response throws `HostedApiError`.

`chat` always returns `responseText`. Optional `hosted.baseUrl` replaces `https://api.clearrun.net`. Optional `hosted.timeoutMs` aborts a slow call.

Package page: [packages/sdk/README.md](../packages/sdk/README.md).

## CLI

```bash
npm install -g @clearrun/cli
npx @clearrun/cli login
clearrun score --text "The Eiffel Tower is in Berlin."
```

`npm install -g @clearrun/cli` still installs 0.2.0 until 0.3.0 is published. 0.2.0 scores with `clearrun verify <file>`. The commands in this section match 0.3.0.

`export CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY` overrides the saved key.

`clearrun score` scores text through `POST /api/score`. `clearrun verify <verdictId>` looks up `GET /api/verify/{verdictId}`. The lookup does not spend a score call and does not need an API key. A file path or `--text` passed to `clearrun verify` is not scored. The command tells you to use `clearrun score`. From code, the CLI exports `scoreText` and `lookupVerdict`. It does not export a scoring `verify()`.

```bash
clearrun login
clearrun whoami
clearrun logout
clearrun score answer.txt
clearrun score responses/ answer.txt --json
clearrun score --config ci/clearrun.config.json --threshold 75
clearrun verify VERDICT_ID
clearrun --help
clearrun --version
```

`clearrun.config.json` can set `paths`, `threshold` (0 to 100), `maxIssues`, and `baseUrl`. With no file and no `--text`, `clearrun score` scores every `.txt` and `.md` file under `paths`. A directory with no `.txt` or `.md` files exits 1. With `--json`, that failure is a JSON error document.

The process exits 1 when any input scores below `threshold`, when a threshold is set and an input has no score, when an input has more issues than `maxIssues`, or when the request fails. A null score fails the run only when a threshold is set.

`--json` prints one shape for one input and for many: `{ "passed": true, "results": [ ... ] }`. Each result includes `passed`. A usage error with `--json` prints `{ "passed": false, "error": "..." }`.

Without a global install: `npx @clearrun/cli score --text "..."`.

Package page: [packages/cli/README.md](../packages/cli/README.md).

## MCP

`@clearrun/mcp` 0.3.0 is a stdio server. It calls the hosted API through the SDK. If no key is configured, `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` return the missing-key message and do not call the API. `clearrun_verify` looks up the public verdict id and does not need a key. The server logs the missing-key message to stderr at startup when scoring has no key. The key is not written into tool results. A key saved with `clearrun login` is used when `CLEARRUN_API_KEY` is unset.

Install by letting the host run:

```bash
npx -y @clearrun/mcp
```

That command still installs npm 0.2.0 until 0.3.0 is published. In 0.2.0, `clearrun_verify` still requires `CLEARRUN_API_KEY`. In 0.3.0, `clearrun_verify` does not read the key. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` need a key in both.

### Claude Desktop

`claude_desktop_config.json`:

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

### Claude Code

Project file `.mcp.json`:

```json
{
  "mcpServers": {
    "clearrun": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@clearrun/mcp"],
      "env": {
        "CLEARRUN_API_KEY": "YOUR_CLEARRUN_API_KEY"
      }
    }
  }
}
```

```bash
claude mcp add clearrun --env CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY -- npx -y @clearrun/mcp
```

### Cursor

Project file `.cursor/mcp.json`:

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

### VS Code

Workspace file `.vscode/mcp.json`:

```json
{
  "servers": {
    "clearrun": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@clearrun/mcp"],
      "env": {
        "CLEARRUN_API_KEY": "YOUR_CLEARRUN_API_KEY"
      }
    }
  }
}
```

### Tools

| Tool | Example arguments |
| --- | --- |
| `clearrun_score` | `{ "responseText": "The Eiffel Tower is in Berlin." }` |
| `clearrun_evaluate` | `{ "prompt": "Where is the Eiffel Tower?", "responseText": "The Eiffel Tower is in Berlin." }` |
| `clearrun_chat` | `{ "message": "What is the capital of France?" }` |
| `clearrun_verify` | `{ "verdictId": "the-verdict-id" }` |

Ask the host in plain language, for example: "Use clearrun_score on this answer." None of the tools fact-check the answer.

A successful score has `scored: true`. A successful chat has `answered: true` and `scored: true`. A 200 body with no verdict, and a chat body with no answer and no verdict, is a tool error (`outcome` is `failed`). That error does not mean a verdict id was invalid.

The registry name in `package.json` is `io.github.adepoco/clearrun-mcp`. The manifest is [packages/mcp/server.json](../packages/mcp/server.json). Directory submission steps are in [LISTINGS.md](./LISTINGS.md).

Package page: [packages/mcp/README.md](../packages/mcp/README.md).

## Verify a verdict

Hosted scoring returns a `verdictId`. Anyone can fetch that record. No API key and no account:

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

The response reports whether the id verifies, and includes the verdict when the API has it. This confirms the stored record. It does not fact-check the original answer, and it does not spend score credits.

SDK: `createVerifyClient().verify({ verdictId })`, or `client.verify({ verdictId })` when you already have a scoring client. MCP: `clearrun_verify`. None of those send an API key. A 200 body that is not a verification result is an error. That error does not mean the verdict id was invalid. The public URL does not use a key either.

## What you get back

The shared object is a `Verdict`. Shape: [schema/verdict.schema.json](../schema/verdict.schema.json) and [CONTRACT.md](./CONTRACT.md).

| Field | Meaning |
| --- | --- |
| `score` | 0 to 100, or null when the API cannot score. Justification, not truth. |
| `grade` | `Well supported`, `Generally reliable`, `Verify before use`, `High risk`, `Likely misleading`, or `Not configured`. |
| `risk` | `low`, `moderate`, `elevated`, or `high`. |
| `failureCategories` | Names only: `redacted`, `redacted`, `redacted`, `redacted`, `redacted`, `redacted`, `redacted`, `redacted`. |
| `summary` | Short rationale. It explains justification, not truth. |
| `verdictId` | Id for `GET /api/verify/{verdictId}`. |
| `signature` | Detached signature from the hosted service, when the API sends one. Clients verify. They do not sign. |

`scoringVersion` is an opaque tag. It is not a formula. The CLI prints a smaller public view: score, grade, risk, issues, summary, verdict id, timestamp, and signature.

## Links

- Site: [https://clearrun.net](https://clearrun.net)
- Pricing: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)
- API keys: [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)
- Verify: `https://api.clearrun.net/api/verify/{id}`
- npm: [@clearrun/sdk](https://www.npmjs.com/package/@clearrun/sdk), [@clearrun/cli](https://www.npmjs.com/package/@clearrun/cli), [@clearrun/mcp](https://www.npmjs.com/package/@clearrun/mcp), [@clearrun/core-types](https://www.npmjs.com/package/@clearrun/core-types)
- GitHub: [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun)
- What "honesty" means: [HONESTY_DEFINITION.md](./HONESTY_DEFINITION.md)
- Methodology: [https://api.clearrun.net/methodology](https://api.clearrun.net/methodology)

ClearRun is made by Adepoco, a California corporation. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).
