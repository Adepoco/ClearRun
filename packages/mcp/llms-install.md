# Install the ClearRun MCP server (Cline)

This file tells an AI agent how to install the ClearRun MCP server for Cline. Follow the steps in order. One install is enough.

The same text is in `llms-install.md` at the repository root and in `packages/mcp/llms-install.md`.

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. It is not a fact-checker. A high score means the confidence matches the justification. It does not mean the answer is true.

The server is local stdio. There is no hosted MCP URL. Do not add a `url` field, and do not set the transport to `streamableHttp` or `sse`.

Package: `@clearrun/mcp`. `mcpName` in `packages/mcp/package.json` is `io.github.Adepoco/clearrun-mcp`. `packages/mcp/server.json` is the registry manifest for that name, version 1.2.1, stdio. This repository's package version is 1.2.1. npm latest is 1.2.0. `npx -y @clearrun/mcp` installs the version npm serves, which is 1.2.0 until 1.2.1 is published. Do not publish this package. Do not open a registry or marketplace submission.

The four tools below match this repository (1.2.1). npm `@clearrun/mcp@1.2.0` exposes the same four tools. On 1.2.0 and 1.2.1, `clearrun_verify` does not read `CLEARRUN_API_KEY`. npm `@clearrun/mcp@0.2.0`, published 2026-10-29, still requires `CLEARRUN_API_KEY` for `clearrun_verify`.

The server calls `https://api.clearrun.net` through `@clearrun/sdk`. It does not score on its own. It never falls back to a mock client.

## Prerequisites

1. Node.js 18 or newer. Check with `node -v`. Node.js 18 includes `npx`.
2. Network access to the npm registry and to `https://api.clearrun.net`.
3. A ClearRun API key is optional. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` need one. `clearrun_verify` does not. Do not invent a key. Do not read or print values from `.env` files.

## Where to get an API key

A signed-in free account with a verified email can create one developer key at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). The full key is shown once and starts with `crun_`. It calls evaluate, score, and chat, and it returns the free verdict: score, grade, risk, and a summary of 16 words or fewer. On that free verdict, `scoringVersion` may be omitted. Do not invent one. An unverified account cannot create a key. A free account can hold one active developer key. Revoke it before creating another.

1. Open [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). Sign in on that page if you need an account. That page is where you create a key.
2. Save the key the user pastes:

```bash
npx @clearrun/cli login
```

Or set `CLEARRUN_API_KEY` in the Cline `env` block below. Do not commit a real key. Do not write a real key into this repository.

The server checks a key passed in code, then `CLEARRUN_API_KEY`, then `~/.config/clearrun/config.json` from `clearrun login`. When `XDG_CONFIG_HOME` is set, the file is `$XDG_CONFIG_HOME/clearrun/config.json`.

In `packages/mcp/server.json`, `CLEARRUN_API_KEY` is a secret and `isRequired` is false.

On Pro, Business, and Enterprise, API access is a saved setting and must be turned on. Turning it off returns 403 and code `API_ACCESS_DISABLED`. A key that is not a free developer key is refused on a free account with 403 and code `API_ACCESS_REQUIRED`.

When no key is configured, `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` return a message that starts with `No ClearRun API key is configured`. The process also logs that message to stderr at startup. That log line does not mean the process crashed. `clearrun_verify` does not need a key and does not send `Authorization`. A missing key does not make `clearrun_verify` return that message. The key is never logged or written into a tool result.

Omit `env` when the user will call `clearrun_verify` only, or when `npx @clearrun/cli login` already saved a key. For score, evaluate, and chat, include `env` unless that config file already has a key.

## Cline configuration

Merge this object into the existing `mcpServers` map. Do not replace the whole settings file. If `mcpServers` is missing, create it. If `clearrun` is already present, update that entry in place.

Settings file:

- Cline CLI: `~/.cline/data/settings/cline_mcp_settings.json`. If `CLINE_MCP_SETTINGS_PATH` is set, edit that file instead.
- Cline IDE extension: in the Cline panel, click the MCP Servers icon, open the Configure tab, and click Configure MCP Servers. Edit the JSON that button opens.

Use this when a key should be passed in the host config. Replace `YOUR_CLEARRUN_API_KEY` with the user's key. Do not commit that value.

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

Use this when `env` should be omitted (`clearrun_verify` only, or a key already saved by `npx @clearrun/cli login`):

```json
{
  "mcpServers": {
    "clearrun": {
      "command": "npx",
      "args": ["-y", "@clearrun/mcp"]
    }
  }
}
```

`command` is `npx`. `args` is `["-y", "@clearrun/mcp"]`. Do not add a version suffix unless the user asks for one. Do not run `npm install -g`.

Cline may also store `disabled` (boolean) and `autoApprove` (array of tool names). Leave `disabled` false or omit it. Leave `autoApprove` empty. Do not auto-approve `clearrun_score`, `clearrun_evaluate`, or `clearrun_chat`. Those calls can spend credits.

After saving, reload MCP servers in Cline. Cline starts the process. Do not start a second copy.

`clearrun_verify` spends no credits. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 4 credits per turn. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Tools

Do not invent tools. The server registers only these four. None of them fact-check the answer.

| Tool | Needs a key | What it does | Example arguments |
| --- | --- | --- | --- |
| `clearrun_score` | Yes | Score text that was already written (`POST /api/score`). | `{ "responseText": "The Eiffel Tower is in Berlin." }` |
| `clearrun_evaluate` | Yes | Score an existing answer, with the prompt when you have it (`POST /api/evaluate`). | `{ "prompt": "Where is the Eiffel Tower?", "responseText": "The Eiffel Tower is in Berlin." }` |
| `clearrun_chat` | Yes | Ask the hosted API to generate an answer and score it (`POST /api/chat`). | `{ "message": "What is the capital of France?" }` |
| `clearrun_verify` | No | Look up a verdict id (`GET /api/verify/{verdictId}`). No API key is sent. | `{ "verdictId": "the-verdict-id" }` |

`clearrun_score` and `clearrun_evaluate` also accept an optional `modelId`. `clearrun_evaluate` and `clearrun_chat` accept an optional `sessionId`. `clearrun_evaluate` accepts an optional `prompt`.

Each tool returns JSON. When the API sends a verdict, the result includes `score` and the `verdict` object as returned, and `scoringVersion` when the API sends it. A `receipt` field is included only when the API sends one. This package does not invent a score, a scoring version, or a receipt.

## Verify the install

1. Run `node -v`. It must report v18 or newer.
2. Run `npm view @clearrun/mcp version`. Until 1.2.1 is published, the printed version is `1.2.0`. That is the package `npx` will run. Do not publish 1.2.1 to change this.
3. Confirm the settings JSON contains `clearrun` with `"command": "npx"` and `"args": ["-y", "@clearrun/mcp"]`. If you set a key, `env.CLEARRUN_API_KEY` is that key, and the key is not committed.
4. If the `cline` command is installed, run `cline config mcp --json` and confirm `clearrun` is listed with that command and those args.
5. In Cline, confirm the server `clearrun` is connected. The tool list must be exactly `clearrun_score`, `clearrun_evaluate`, `clearrun_chat`, and `clearrun_verify`.
6. Do not run `npx -y @clearrun/mcp` in a terminal to see if it prints a ready line. The process speaks MCP on stdio and prints no ready banner. A quiet process is the server waiting. Stop it if you started it by hand. Let Cline own the process.
7. Key check, only if no key is configured: ask Cline to call `clearrun_score` with `{ "responseText": "The Eiffel Tower is in Berlin." }`. The tool should return the missing-key message and should not call the API. `clearrun_verify` should not return that missing-key message when no key is configured.
8. Key check, only if a key is configured: ask Cline to call `clearrun_score` with the same arguments. A result that includes `score` means the hosted API returned a score. It does not mean the sentence is true. A 403 or 429 means the server did start. See troubleshooting.
9. Call `clearrun_verify` only with a verdict id the user already has. The lookup does not fact-check the original answer. You can also run `curl https://api.clearrun.net/api/verify/VERDICT_ID` with that id. That public request does not use an API key.

## Troubleshooting

- `node -v` is older than 18: install Node.js 18 or newer, then reopen the terminal so `npx` is on `PATH`.
- Cline says the command was not found: confirm `npx` runs in the same environment Cline uses. On Windows, if `npx` is not found, set `command` to `npx.cmd` and keep the same `args`.
- The settings file was overwritten and other servers disappeared: restore the previous file and merge `clearrun` into `mcpServers` instead of replacing the file.
- Score, evaluate, or chat returns `No ClearRun API key is configured`: set `CLEARRUN_API_KEY` in `env`, or run `npx @clearrun/cli login`, then reload the server. `clearrun_verify` does not need this.
- Stderr prints the missing-key line at startup: expected when no key is configured. The server can still be connected. `clearrun_verify` still works.
- HTTP 403 and code `API_ACCESS_REQUIRED`: the account is free and the key is not a free developer key. Create the free developer key at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys).
- HTTP 403 and code `API_ACCESS_DISABLED`: on Pro, Business, or Enterprise, API access is turned off. Turn it on in the account settings. That switch does not turn a free developer key on or off.
- HTTP 429 with `Retry-After`: wait for the time the response gives, then try the call again. Do not start extra server processes.
- `clearrun_verify` asks for `CLEARRUN_API_KEY`: the running package is likely `@clearrun/mcp@0.2.0` (published 2026-10-29) or another build from before 0.3.0. `npm view @clearrun/mcp version` should be 1.2.0 or newer. Clear a stale npx cache and reload Cline so it runs the current npm version. Do not publish a new version from this repository.
- `npx` installed 1.2.0 while this repository says 1.2.1: expected until a maintainer publishes 1.2.1. The install command stays `npx -y @clearrun/mcp`.
- A tool name other than the four listed above appears: stop. This server does not register other tools. Do not add any.
- The key appears in a log or a tool result: it should not. Remove it from logs you save, and rotate the key at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys) if it was exposed.

## Logo

This repository has no 400x400 PNG logo. Do not add an image file. Do not invent a logo path.

## From a git clone

Use this only when `npx` cannot reach the npm registry. From a clone of [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun):

```bash
npm install
npm run build -w @clearrun/mcp
```

Point Cline `command` at `node` and `args` at the absolute path of `packages/mcp/dist/index.js`. Keep the same `env` rules as above. This path runs the repository copy (1.2.1), not the npm tarball (1.2.0).

## Links

- npm: [https://www.npmjs.com/package/@clearrun/mcp](https://www.npmjs.com/package/@clearrun/mcp)
- GitHub: [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun)
- Package README: [packages/mcp/README.md](https://github.com/Adepoco/ClearRun/blob/main/packages/mcp/README.md)
- Keys: [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)
- Pricing: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)
- Site: [https://clearrun.net](https://clearrun.net)
