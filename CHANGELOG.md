# Changelog

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