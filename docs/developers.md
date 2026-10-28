# ClearRun for developers

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

This page is the adoption guide for the three public clients. It is written so it can later live at `clearrun.net/developers`.

The clients call the hosted API at `https://api.clearrun.net`. They do not contain the scoring engine, its weights, or its formula. Source: [github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun).

## Why use it

Put a check on answers your product will show, store, or act on. ClearRun reports when the confidence in an answer outruns the reasoning in that answer. You get a score, a grade, named failure categories, and a signed verdict another person can open later. ClearRun does not block, rewrite, or approve the answer.

Pick one client:

| You are building | Package | Published |
| --- | --- | --- |
| An app, script, or service | [`@clearrun/sdk`](https://www.npmjs.com/package/@clearrun/sdk) | 0.1.1 |
| A terminal or CI check | [`@clearrun/cli`](https://www.npmjs.com/package/@clearrun/cli) | 0.1.1 |
| A tool inside Claude, Cursor, or VS Code | [`@clearrun/mcp`](https://www.npmjs.com/package/@clearrun/mcp) | 0.1.2 |

Shared types are [`@clearrun/core-types`](https://www.npmjs.com/package/@clearrun/core-types) 0.1.0. Node.js 18 or newer.

## Access

An API key is required for hosted scoring. Keys are a Pro plan or higher feature. Create one while signed in:

[https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)

A free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

Set this environment variable everywhere:

```bash
export CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY
```

Do not commit a real key. The SDK also accepts `hosted.apiKey`. The CLI also accepts `--api-key`. The MCP server reads `CLEARRUN_API_KEY` from the host config.

Without a key, `createKernelClient()` throws. Pass `{ forceMock: true }` only for local development. The mock returns schema-valid verdicts, never real scores. The CLI and the MCP server do not offer that mock.

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 26 credits per turn.

[https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)

Those two sentences are the credit costs stated on that page. If the page changes, the page is the source. This guide does not add other credit numbers. The CLI calls score only, so each file or `--text` input costs at least 3 credits.

## SDK

```bash
npm install @clearrun/sdk
```

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

Auth on score, evaluate, and chat is `Authorization: Bearer <apiKey>`. `verify` does not send the key. Creating the client still requires one, unless you opted into the mock. A non-2xx response throws `HostedApiError`.

`chat` always returns `responseText`. Optional `hosted.baseUrl` replaces `https://api.clearrun.net`. Optional `hosted.timeoutMs` aborts a slow call.

Package page: [packages/sdk/README.md](../packages/sdk/README.md).

## CLI

```bash
npm install -g @clearrun/cli
export CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY
clearrun verify --text "The Eiffel Tower is in Berlin."
```

`clearrun verify` scores text through `POST /api/score`. It does not look up a verdict id. Use the curl in the verify section for that.

```bash
clearrun verify answer.txt
clearrun verify responses/ answer.txt --json
clearrun verify --config ci/clearrun.config.json --threshold 75
clearrun --help
clearrun --version
```

`clearrun.config.json` can set `paths`, `threshold` (0 to 100), `maxIssues`, and `baseUrl`. With no file and no `--text`, `clearrun verify` scores every `.txt` and `.md` file under `paths`. The process exits 1 when any input is below `threshold`, has no score, has more issues than `maxIssues`, or the request fails.

Without a global install: `npx @clearrun/cli verify --text "..."`.

Package page: [packages/cli/README.md](../packages/cli/README.md).

## MCP

`@clearrun/mcp` 0.1.2 is a stdio server. It calls the hosted API through the SDK. If `CLEARRUN_API_KEY` is missing, every tool returns an error and does not call the API. The key is not written into tool results.

Install by letting the host run:

```bash
npx -y @clearrun/mcp
```

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

The registry name in `package.json` is `io.github.adepoco/clearrun-mcp`. The manifest is [packages/mcp/server.json](../packages/mcp/server.json). Directory submission steps are in [LISTINGS.md](./LISTINGS.md).

Package page: [packages/mcp/README.md](../packages/mcp/README.md).

## Verify a verdict

Hosted scoring returns a `verdictId`. Anyone can fetch that record. No API key and no account:

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

The response reports whether the id verifies, and includes the verdict when the API has it. This confirms the stored record. It does not fact-check the original answer, and it does not spend score credits.

SDK: `client.verify({ verdictId })`. MCP: `clearrun_verify`. The MCP tool still requires `CLEARRUN_API_KEY` to be configured, because the server checks the key before every tool. The public URL does not.

## What you get back

The shared object is a `Verdict`. Shape: [schema/verdict.schema.json](../schema/verdict.schema.json) and [CONTRACT.md](./CONTRACT.md).

| Field | Meaning |
| --- | --- |
| `score` | 0 to 100, or null when the API cannot score. Justification, not truth. |
| `grade` | `Well supported`, `Generally reliable`, `Verify before use`, `High risk`, `Likely misleading`, or `Not configured`. |
| `risk` | `low`, `moderate`, `elevated`, or `high`. |
| `failureCategories` | Names only: `overconfidence`, `unjustified_assertion`, `internal_inconsistency`, `ambiguity_suppression`, `confidence_domain_mismatch`, `unilateral_assertion`, `scope_drift`, `fabrication_risk`. |
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
