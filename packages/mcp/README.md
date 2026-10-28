# @clearrun/mcp

Stdio [MCP](https://modelcontextprotocol.io) server for [ClearRun](https://clearrun.net). Version 0.1.1.

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

The server calls the hosted API at `https://api.clearrun.net` through `@clearrun/sdk`. It does not score on its own. The scoring engine stays in the hosted service. This package does not contain scoring logic, weights, or formulas, and it never falls back to the mock client.

## Why use it

Use it when an assistant should check an answer before you rely on it. The tools return a 0 to 100 honesty score, a grade, named failure categories, and, when the API sends one, a signed verdict you can look up again. The same check is available in Claude Desktop, Claude Code, Cursor, and VS Code.

## Access

An API key is required. Keys are a Pro plan or higher feature. Create one while signed in at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). A free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

Set the key in the environment variable `CLEARRUN_API_KEY`. The server also accepts a key passed in code when you construct it. If the key is missing, every tool returns an error and does not call the API. The key is never logged or written into a tool result. Do not commit a real key.

Node.js 18 or newer is required.

## Install

```bash
npx -y @clearrun/mcp
```

Or install it in a project:

```bash
npm install @clearrun/mcp
```

`@clearrun/mcp` 0.1.1 depends on `@clearrun/sdk` ^0.1.1 and `@clearrun/core-types` ^0.1.0.

From a clone of [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun):

```bash
npm install
npm run build -w @clearrun/mcp
node packages/mcp/dist/index.js
```

From a clone, point the host `command` at `node` and `args` at the absolute path of `packages/mcp/dist/index.js`. Keep the same `env` block.

## Host configuration

Each block runs `npx -y @clearrun/mcp` and passes `CLEARRUN_API_KEY` in `env`. Replace `YOUR_CLEARRUN_API_KEY` with a Pro key. Prefer your host's secret input when it has one, so the key is not stored in the repo.

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

Each tool returns JSON. When the API sends a verdict, the result includes `score`, `scoringVersion`, and the `verdict` object as returned. `responseText` (chat) and `verified` (verify) are included when the API sends them. A `receipt` field is included only when the API sends one. This package does not invent a scoring version or a receipt.

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

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 26 credits per turn. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Verify a verdict

Hosted verdicts can be checked again with no account:

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

That public request does not use an API key. The MCP tool `clearrun_verify` still requires `CLEARRUN_API_KEY`, because the server refuses every tool when the key is missing. The lookup does not fact-check the original answer. It returns the verification result the API returns.

## Registry name

`package.json` sets `mcpName` to `io.github.adepoco/clearrun-mcp`. `server.json` in this package is the Official MCP Registry manifest (npm package `@clearrun/mcp`, version 0.1.1, stdio, `CLEARRUN_API_KEY` as a required secret). Publishing that manifest is a separate step from this repository. See [docs/LISTINGS.md](https://github.com/Adepoco/ClearRun/blob/main/docs/LISTINGS.md).

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
