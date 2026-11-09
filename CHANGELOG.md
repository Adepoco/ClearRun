# Changelog

## Unreleased

### @clearrun/cli
- `clearrun score` scores files, directories, and `--text`. `clearrun verify <verdictId>` looks up `GET /api/verify/{verdictId}` and does not spend a score call. It does not need an API key.
- A directory with no `.txt` or `.md` files exits 1. With `--json`, stdout is an error document.
- `--json` uses one shape for one input and many: `{ "passed", "results" }`. Each result includes `passed`.
- A null score fails the run only when a threshold is set.

### @clearrun/sdk
- `createVerifyClient()` looks up a verdict id without an API key. `score`, `evaluate`, and `chat` still require a key.

### @clearrun/mcp
- A hosted 200 body with no readable verdict is a tool error. Chat reports answered, scored, or failed. `clearrun_verify` does not require an API key.
- `packages/mcp/server.json` no longer marks `CLEARRUN_API_KEY` required. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` still need a key. `clearrun_verify` does not read it.

### Docs
- READMEs, the developer guide, CLI help, and the MCP manifest match the source above. A file or `--text` passed to `clearrun verify` is not scored. The CLI exports `scoreText` and `lookupVerdict`, not a scoring `verify()`.
- Per-call costs match the public pricing page: evaluate and score cost at least 3 credits, and chat costs at most 1 credit per turn. The free plan includes 30 monthly credits and does not include API access. API access on Pro and higher is a saved setting. Turning it off stops API keys from working. Training participation is saved on the same account page.
- npm `@clearrun/cli`, `@clearrun/sdk`, and `@clearrun/mcp` remain 0.2.0, published 2026-10-29. This repository does not publish a new version. Those tarballs still score with `clearrun verify <file>`, the CLI still exports a scoring `verify()`, and MCP verify still requires a key.
- Package versions were not bumped.

## 0.2.0 (2026-10-29)

### @clearrun/cli
- Version 0.2.0.
- `clearrun login` opens https://api.clearrun.net/account/keys, asks for a key, and saves it to `~/.config/clearrun/config.json` with mode 0600.
- `clearrun logout` removes that saved key. `clearrun whoami` prints a masked key and where it came from.
- Key lookup order: `--api-key`, `CLEARRUN_API_KEY`, the user config file, then `apiKey` in `clearrun.config.json`.
- The first run with no key prints a one-time hint. There is no npm postinstall script.
- In this 0.2.0 release, `clearrun verify` scored text and exited 1 with the missing-key message when no key was configured. Current source uses `clearrun score` for text and `clearrun verify <verdictId>` for lookup.

### @clearrun/sdk
- Version 0.2.0.
- `createKernelClient()` reads `CLEARRUN_API_KEY`, then the CLI config file.
- A missing key throws `MissingApiKeyError`. The message includes the keys page, `npx @clearrun/cli login`, and `CLEARRUN_API_KEY`.

### @clearrun/mcp
- Version 0.2.0. Depends on `@clearrun/sdk` ^0.2.0.
- Tools return the same missing-key message. Startup logs it to stderr when no key is configured.
- The server reads the CLI config file when `CLEARRUN_API_KEY` is unset.
- `server.json` is at version 0.2.0. This repository does not publish the package.

Login does not call the API. Scoring routes spend credits, and the account routes use a browser session. A device-login flow that returns a key without a paste would need hosted endpoints: `POST /api/cli/device` and `POST /api/cli/device/token`.

## 0.1.2 (2026-10-28)

### @clearrun/mcp
- Version 0.1.2. Does not change `@clearrun/sdk` (0.1.1), `@clearrun/cli` (0.1.1), or `@clearrun/core-types` (0.1.0).
- `package.json` sets `mcpName` to `io.github.adepoco/clearrun-mcp` for the Official MCP Registry. `packages/mcp/server.json` is the registry manifest at version 0.1.2.
- `docs/README.md` links the adoption guide (`docs/developers.md`) and the directory checklist (`docs/LISTINGS.md`).

## Unreleased

### @clearrun/mcp 0.1.1
- New stdio MCP server. It calls the hosted API through `@clearrun/sdk` and does not score locally.
- Package version 0.1.1. Depends on `@clearrun/sdk` ^0.1.1 and `@clearrun/core-types` ^0.1.0.
- Does not change `@clearrun/sdk` (0.1.1), `@clearrun/cli` (0.1.1), or `@clearrun/core-types` (0.1.0).

## 0.1.1 (2026-10-18)

Packages: `@clearrun/cli` 0.1.1 and `@clearrun/sdk` 0.1.1. The other four packages stay at 0.1.0.

### @clearrun/cli
- `clearrun --help`, `clearrun -h` and `clearrun help` now print help. In 0.1.0 they printed "Unknown command: --help".
- `--config <path>` now works. Paths in the config file resolve relative to that file.
- The `paths`, `threshold` and `maxIssues` config fields now work. In this 0.1.1 release, `clearrun verify` with no file scored every `.txt` and `.md` file under `paths` (dot folders and `node_modules` skipped). Current source uses `clearrun score` for that.
- New `--threshold <0-100>` flag, which overrides the config value. A run exits 1 if any input scores below it, has no score, or has more issues than `maxIssues`.
- In this 0.1.1 release, `clearrun verify` took several files or directories at once. With `--json` and more than one input, it printed one entry per input with its pass state. Current source uses `clearrun score` for files. `clearrun verify` looks up a verdict id.
- New `--version` flag.
- Bad config files (invalid JSON or wrong field types) are now reported instead of silently ignored. Unknown options and flags missing a value are reported too.
- Fixed the garbled dash in the help header.

### @clearrun/sdk
- `HostedApiClient.chat()` always returns `responseText`. The hosted API returned the answer as `response`, so in 0.1.0 `responseText` came back undefined. The client now accepts either field and prefers `responseText`.

## 0.1.0

First public release of all six packages.