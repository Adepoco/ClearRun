# Changelog

## 0.2.0 (2026-10-29)

### @clearrun/cli
- Version 0.2.0.
- `clearrun login` opens https://api.clearrun.net/account/keys, asks for a key, and saves it to `~/.config/clearrun/config.json` with mode 0600.
- `clearrun logout` removes that saved key. `clearrun whoami` prints a masked key and where it came from.
- Key lookup order: `--api-key`, `CLEARRUN_API_KEY`, the user config file, then `apiKey` in `clearrun.config.json`.
- The first run with no key prints a one-time hint. There is no npm postinstall script.
- `clearrun verify` exits 1 with the missing-key message when no key is configured.

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
- The `paths`, `threshold` and `maxIssues` config fields now work. `clearrun verify` with no file scores every `.txt` and `.md` file under `paths` (dot folders and `node_modules` skipped).
- New `--threshold <0-100>` flag, which overrides the config value. A run exits 1 if any input scores below it, has no score, or has more issues than `maxIssues`.
- `clearrun verify` takes several files or directories at once. With `--json` and more than one input, it prints one entry per input with its pass state.
- New `--version` flag.
- Bad config files (invalid JSON or wrong field types) are now reported instead of silently ignored. Unknown options and flags missing a value are reported too.
- Fixed the garbled dash in the help header.

### @clearrun/sdk
- `HostedApiClient.chat()` always returns `responseText`. The hosted API returned the answer as `response`, so in 0.1.0 `responseText` came back undefined. The client now accepts either field and prefers `responseText`.

## 0.1.0

First public release of all six packages.