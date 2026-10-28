# @clearrun/mcp

Stdio [MCP](https://modelcontextprotocol.io) server for ClearRun. It calls the hosted API at `https://api.clearrun.net` through `@clearrun/sdk` (`createKernelClient` / `HostedApiClient`). Version 0.1.1. It depends on `@clearrun/sdk` ^0.1.1 and `@clearrun/core-types` ^0.1.0.

ClearRun scores honesty: whether an answer's confidence is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification, not that the answer is true.

The scoring engine stays in the hosted service. This package does not contain scoring logic, weights, or formulas, and it never falls back to the mock scorer.

No API key, no use. The server reads `CLEARRUN_API_KEY`, or a key passed in code when you construct the server. If that key is missing, every tool returns an error telling you to get a ClearRun API key (Pro plan or higher). The key is never logged or written into a tool result.

## Install

```bash
npm install @clearrun/mcp
```

From a clone of this repository:

```bash
npm install
npm run build -w @clearrun/mcp
node packages/mcp/dist/index.js
```

Publishing this package to npm is a separate step. This repository build does not publish it.

## Claude Desktop and Cursor

Both hosts use the same server entry. Put your own key in `CLEARRUN_API_KEY`. Do not commit a real key.

Claude Desktop: `claude_desktop_config.json`. Cursor: `~/.cursor/mcp.json` (or the project `.cursor/mcp.json`).

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

From a clone, point `command` at `node` and `args` at the absolute path of `packages/mcp/dist/index.js`. Keep the same `env` block.

API keys are a Pro feature. Create one while signed in at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys).

## Tools

Each tool returns JSON. When the API sends a verdict, the result includes `score`, `scoringVersion`, and the `verdict` object as returned. `responseText` (chat) and `verified` (verify) are included when the API sends them. A `receipt` field is included only when the API sends one. This package does not invent a scoring version or a receipt.

| Tool | What it does |
| --- | --- |
| `clearrun_score` | Score text that was already written (`POST /api/score`). Honesty calibration, not a fact check. |
| `clearrun_evaluate` | Score an existing answer, with the prompt that produced it when you have it (`POST /api/evaluate`). |
| `clearrun_chat` | Ask the hosted API to generate an answer and score it (`POST /api/chat`). |
| `clearrun_verify` | Look up a verdict id (`GET /api/verify/{verdictId}`). Returns the verification result the API returns. This does not fact-check the original answer. |

A 403 from the API is returned as text, including the API message `API access requires a Pro plan or higher.` when that is what the API sends.
