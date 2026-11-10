# @clearrun/mcp

## Get an API key

Hosted scoring needs a ClearRun account, API access, and an API key. API access is a saved setting on Pro and higher. Turning it off stops API keys from working. The free plan includes 30 monthly credits and does not include API access, so a free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

ClearRun does not use your content to train third-party or generation models. Whether your evaluations may help improve ClearRun's own scoring is an account setting: free plans start opted in, paid plans start opted out, and Enterprise stays off.

1. Open [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). Sign in on that page if you need an account. That page is where you create a key.
2. Save the key:

```bash
npx @clearrun/cli login
```

Or set `CLEARRUN_API_KEY` in the host config below. Do not commit a real key.

The server checks a key passed in code, then `CLEARRUN_API_KEY`, then `~/.config/clearrun/config.json` from `clearrun login`. When no key is configured, `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` return that same message and the process logs it to stderr at startup. `clearrun_verify` does not need a key. The key is never logged or written into a tool result.

Stdio [MCP](https://modelcontextprotocol.io) server for [ClearRun](https://clearrun.net). Version 1.2.0.

`clearrun_verify` looks up a verdict with no API key. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` need a key. npm `@clearrun/mcp@0.2.0`, published 2026-10-29, still requires `CLEARRUN_API_KEY` for `clearrun_verify`.

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

The server calls the hosted API at `https://api.clearrun.net` through `@clearrun/sdk`. It does not score on its own. The scoring engine stays in the hosted service. This package does not contain scoring logic, weights, or formulas, and it never falls back to the mock client.

## Why use it

Use it when an assistant should check an answer before you rely on it. The tools return a 0 to 100 honesty score, a grade, component signals, and, when the API sends one, a signed verdict you can look up again. The same check is available in Claude Desktop, Claude Code, Cursor, and VS Code.

## Access

See **Get an API key** above. A key passed to `createClearRunServer({ apiKey })` overrides the environment and the config file.

Node.js 18 or newer is required.

## Install

```bash
npx -y @clearrun/mcp
```

Or install it in a project:

```bash
npm install @clearrun/mcp
```

`@clearrun/mcp` 0.3.1 depends on `@clearrun/sdk` ^0.3.1 and `@clearrun/core-types` ^0.1.1. `npx -y @clearrun/mcp` installs npm 0.3.0 until 0.3.1 is published. In the 0.2.0 build, `clearrun_verify` still requires `CLEARRUN_API_KEY`. The tool list below matches 0.3.1, where verify does not read the key. Published 0.3.0 still allows `@clearrun/core-types` 0.1.0, which rejects schema 1.1.0 coarse responses and coarse 1.0.0 public and free verdicts.

From a clone of [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun):

```bash
npm install
npm run build -w @clearrun/mcp
node packages/mcp/dist/index.js
```

From a clone, point the host `command` at `node` and `args` at the absolute path of `packages/mcp/dist/index.js`. Keep the same `env` block.

## Host configuration

Each block runs `npx -y @clearrun/mcp` and passes `CLEARRUN_API_KEY` in `env`. Replace `YOUR_CLEARRUN_API_KEY` with a Pro key that has API access turned on. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` need that key. Omit `env` only when the host will call `clearrun_verify` alone. Prefer your host's secret input when it has one, so the key is not stored in the repo.

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`).

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

Restart Claude Desktop after saving.

### Claude Code

Project file `.mcp.json` at the repository root:

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

Or add it from the terminal. The `--` keeps `-y` attached to `npx`.

```bash
claude mcp add clearrun --env CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY -- npx -y @clearrun/mcp
```

Approve the server when Claude Code asks, then run `/mcp` and confirm `clearrun` is connected.

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

The same object works in the user file `~/.cursor/mcp.json`.

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

To keep the key out of the file, set `CLEARRUN_API_KEY` in your environment and use `"${env:CLEARRUN_API_KEY}"` as the value. User-level setup is the command `MCP: Open User Configuration`.

## Tools

Each tool returns JSON. When the API sends a verdict, the result includes `score` and the `verdict` object as returned, and `scoringVersion` when the API sends it. `responseText` (chat) and `verified` (verify) are included when the API sends them. A `receipt` field is included only when the API sends one. This package does not invent a scoring version or a receipt. A schema 1.1.0 coarse response and a coarse 1.0.0 public or free verdict still count as a verdict. Coarse 1.0.0 keeps the verdict id, schema version, score, grade, risk, summary, timestamp, and signature fields, and omits scoring version, failure categories, confidence interval, named signals, and the signals digest.

`scored` is true when the body has a verdict. `answered` is true when chat text is present. A 200 body of `{}`, or a chat body with neither `responseText` nor `response`, is a tool error. A chat answer with no verdict is `answered` and not `scored`.

None of these tools fact-check the answer.

| Tool | What it does | Example arguments |
| --- | --- | --- |
| `clearrun_score` | Score text that was already written (`POST /api/score`). | `{ "responseText": "The Eiffel Tower is in Berlin." }` |
| `clearrun_evaluate` | Score an existing answer, with the prompt when you have it (`POST /api/evaluate`). | `{ "prompt": "Where is the Eiffel Tower?", "responseText": "The Eiffel Tower is in Berlin." }` |
| `clearrun_chat` | Ask the hosted API to generate an answer and score it (`POST /api/chat`). | `{ "message": "What is the capital of France?" }` |
| `clearrun_verify` | Look up a verdict id (`GET /api/verify/{verdictId}`). | `{ "verdictId": "the-verdict-id" }` |

`clearrun_score` and `clearrun_evaluate` also accept an optional `modelId`. `clearrun_evaluate` and `clearrun_chat` accept an optional `sessionId`.

In a host, ask in plain language, for example: "Use clearrun_score on this answer." The host fills the arguments.

A 403 from the API is returned as text, including `API access requires a Pro plan or higher.` when that is what the API sends.

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 1 credit per turn. `clearrun_verify` spends no credits. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Verify a verdict

Hosted verdicts can be checked again with no account:

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

That public request does not use an API key. The MCP tool `clearrun_verify` does not need one either, and it does not send `Authorization`. The lookup does not fact-check the original answer. It returns the verification result the API returns. A body that is not a verification result is a tool error. That error does not mean the verdict id was invalid.

## Registry name

`package.json` sets `mcpName` to `io.github.adepoco/clearrun-mcp`. `server.json` in this package is the Official MCP Registry manifest (npm package `@clearrun/mcp`, version 1.2.0, stdio). `CLEARRUN_API_KEY` is a secret and `isRequired` is false: `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` need it, and `clearrun_verify` does not. Publish the npm tarball before that manifest. The published `@clearrun/mcp@0.3.0` tarball does not match it. See [docs/LISTINGS.md](https://github.com/Adepoco/ClearRun/blob/main/docs/LISTINGS.md).

## Links

- npm: [https://www.npmjs.com/package/@clearrun/mcp](https://www.npmjs.com/package/@clearrun/mcp)
- GitHub: [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun)
- Site: [https://clearrun.net](https://clearrun.net)
- Pricing: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)
- API keys: [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)
- SDK: [https://www.npmjs.com/package/@clearrun/sdk](https://www.npmjs.com/package/@clearrun/sdk)
- CLI: [https://www.npmjs.com/package/@clearrun/cli](https://www.npmjs.com/package/@clearrun/cli)
- Developer guide: [docs/developers.md](https://github.com/Adepoco/ClearRun/blob/main/docs/developers.md)

ClearRun is made by Adepoco, a California corporation. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).

## License

MIT. The hosted scoring service is licensed separately.
