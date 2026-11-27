# Listing checklist

Submit `@clearrun/mcp` after the package people will install is the one you describe. The server in this repository is stdio, npm package `@clearrun/mcp` 1.2.1, started with `npx -y @clearrun/mcp`. `CLEARRUN_API_KEY` is a secret for `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat`. `clearrun_verify` does not read it, so [packages/mcp/server.json](../packages/mcp/server.json) sets `isRequired` to false. npm serves `@clearrun/sdk`, `@clearrun/cli`, and `@clearrun/core-types` at 1.2.0, and `@clearrun/mcp` at 1.2.0. This repository's `@clearrun/mcp` is 1.2.1, and both `server.json` version fields are 1.2.1. Publish `@clearrun/mcp@1.2.1` to npm before the registry manifest. Do not publish the manifest against 1.2.0, 0.3.0, 0.2.0, or 0.1.1. `@clearrun/mcp@0.2.0` (published 2026-10-29) still requires a key for `clearrun_verify`. `@clearrun/mcp@0.3.0` is published and still depends on `@clearrun/core-types` ^0.1.0. This repository does not run `npm publish` or the registry publish.

A signed-in free account with a verified email can create one developer key at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). The full key is shown once and starts with `crun_`. It calls evaluate, score, and chat, and it returns the free verdict: score, grade, risk, and a summary of 16 words or fewer. `componentSignals` is limited to Evidence support and Reasoning integrity. `confidenceInterval` and `scoringVersion` are omitted. Calls spend the free plan's 30 monthly credits. The default cap is 2 requests a second, 6 a minute, 30 an hour, and 40 a day. Evaluate, score, and chat share that cap. Over the cap, the API returns 429 and `Retry-After`. Signed-in chat and Paste Check on api.clearrun.net do not use the key. Chain verification and audit export need a Pro plan or higher. An unverified account cannot create a key. A free account can hold one active developer key. Revoke it before creating another. A key that is not a free developer key is refused on a free account with 403 and code `API_ACCESS_REQUIRED`. On Pro, Business, and Enterprise, API access is a saved setting. Turning it off returns 403 and code `API_ACCESS_DISABLED`. That switch does not turn a free developer key on or off.

Directory forms checked 28 October 2026. Re-open each form before you submit. Pages change. Version facts checked 26 November 2026 against npm. Free developer key facts checked 11 November 2026 against [https://api.clearrun.net/developers](https://api.clearrun.net/developers).

One-line description you can reuse:

```text
Scores AI answers for honesty (whether confidence is backed by its reasoning). Not a fact-checker.
```

## Official MCP Registry

Do this before PulseMCP. The manifest is [packages/mcp/server.json](../packages/mcp/server.json). `mcpName` in [packages/mcp/package.json](../packages/mcp/package.json) is `io.github.Adepoco/clearrun-mcp`. That name matches `server.json`. The namespace is the GitHub org login `Adepoco`. The Official MCP Registry treats GitHub namespaces as case-sensitive ([registry issue #689](https://github.com/modelcontextprotocol/registry/issues/689)). Schema: `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`. Docs: [registry quickstart](https://modelcontextprotocol.io/registry/quickstart) and [authentication](https://modelcontextprotocol.io/registry/authentication).

`mcpName` is read from the **published** npm package. npm `@clearrun/mcp@0.1.1` does not contain it. This repo is 1.2.1 in `package.json` and in both `server.json` version fields. npm `@clearrun/mcp@1.2.0` is published, depends on `@clearrun/sdk` ^1.2.0 and `@clearrun/core-types` ^1.2.0, and its `mcpName` lowercases the org login `Adepoco`. That tarball does not match `io.github.Adepoco/clearrun-mcp`. npm `@clearrun/mcp@0.3.0` is still published and still depends on `@clearrun/core-types` ^0.1.0. npm `@clearrun/mcp@0.2.0` (published 2026-10-29) still requires an API key for `clearrun_verify`. `server.json` in this repository says the key is not required, because the source tool does not use it. Do not publish this manifest against 1.2.0, 0.3.0, 0.2.0, or 0.1.1. Publish `@clearrun/mcp@1.2.1` first, then publish the registry manifest for 1.2.1.

This repository does not run `npm publish` or `mcp-publisher publish`. It does not add a GitHub Actions workflow for the registry.

```bash
# 1.2.1 is not on npm yet. 1.2.0 is.
# package.json and both server.json version fields are 1.2.1.
# mcpName is io.github.Adepoco/clearrun-mcp.
# Do not publish the registry manifest against 1.2.0. This repository does not run npm publish.
curl -s https://registry.npmjs.org/@clearrun/mcp/1.2.0 | jq -r .mcpName
# That tarball still lowercases Adepoco. It does not match io.github.Adepoco/clearrun-mcp.

# A maintainer publishes 1.2.1 from the repository root.
# @clearrun/sdk 1.2.0 and @clearrun/core-types 1.2.0 are already on npm.
# This release does not bump them. Use an npm account with access to @clearrun.
# Do not put an npm token in shell history you share, and do not commit one.
# npm publish --access public -w @clearrun/mcp
curl -s https://registry.npmjs.org/@clearrun/mcp/1.2.1 | jq -r .mcpName
# Expected output: io.github.Adepoco/clearrun-mcp

# Install mcp-publisher:
# https://modelcontextprotocol.io/registry/quickstart
# GitHub auth grants io.github.Adepoco/* when the org login matches, including case.
# https://github.com/modelcontextprotocol/registry/issues/689
# https://modelcontextprotocol.io/registry/authentication
cd packages/mcp
mcp-publisher login github
mcp-publisher publish
```

Publishing under `io.github.Adepoco` needs an Owner of the `Adepoco` GitHub org. `mcp-publisher login github` with no token grants your personal namespace. The device flow cannot read organization membership. To publish this name, sign in as an Owner with a classic personal access token that has the `read:org` scope, or a fine-grained token with Organization members set to read-only: `mcp-publisher login github --token`. Keep that token out of the repo and out of shell history you share. This repository does not add a GitHub Actions workflow.

Confirm:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Adepoco/clearrun-mcp"
```

## Smithery

Docs: [https://smithery.ai/docs/build/publish](https://smithery.ai/docs/build/publish).

This server is local stdio. The URL flow at [https://smithery.ai/new](https://smithery.ai/new) is for a public HTTPS Streamable HTTP server, so it does not fit `@clearrun/mcp`.

1. Build an MCPB bundle for the stdio server. Smithery's page points at Anthropic's MCPB guide for the bundle format. This repo does not ship a bundle yet.
2. Publish the bundle: `smithery mcp publish ./server.mcpb -n adepoco/clearrun-mcp`
3. Finish the publishing flow on Smithery. The page also has a bundle upload API if you are not using the CLI.
4. Open the server's Settings, then Verification, if you want the official-vendor check.

## Glama

Listing: [https://glama.ai/mcp/servers/Adepoco/ClearRun](https://glama.ai/mcp/servers/Adepoco/ClearRun). Docs checked 27 November 2026: [glama.json](https://glama.ai/blog/2025-07-08-what-is-glamajson), [schema](https://glama.ai/mcp/schemas/server.json), [how indexing builds a Dockerfile](https://glama.ai/mcp/methodology), [how to make a release](https://glama.ai/blog/2026-03-15-how-to-make-a-release).

Glama builds a container and runs `initialize` plus `tools/list` over stdio with no secrets. This server already starts that way. `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat` return an error until `CLEARRUN_API_KEY` is set. `clearrun_verify` does not read the key.

- [glama.json](../glama.json) at the repository root names GitHub user `rlshaw-ml`. The schema allows `$schema` and `maintainers` only.
- [Dockerfile](../Dockerfile) at the repository root builds `@clearrun/mcp` from this repo and starts `node packages/mcp/dist/index.js` on stdio. It does not install a published npm tarball, because 1.2.1 is not on npm, and it does not bake in a key. No port is published.
- [LICENSE](../LICENSE) is MIT, which Glama's license check looks for.

A Glama release is not a GitHub release. This repository does not publish it. After the files above are on `main`, someone signed in as `rlshaw-ml` still has to:

1. Open the listing Score tab and claim the server so Glama reads `glama.json`. Claiming again picks up a new `glama.json`.
2. Sync the server so the build uses the latest `main`. Leave any pinned commit empty.
3. Open [the Dockerfile admin page](https://glama.ai/mcp/servers/Adepoco/ClearRun/admin/dockerfile). If Glama uses the repository Dockerfile, keep that. If the form asks for build steps and command arguments, use `npm ci` then `npm run build -w @clearrun/mcp`, and command arguments `node` and `packages/mcp/dist/index.js`. Leave `CLEARRUN_API_KEY` unset and placeholder parameters empty so the inspector can list tools.
4. Click Deploy. When the build test passes, click Make Release and publish. That is what adds the deployable badge and runs the quality score.

## mcp.so

1. Open [https://mcp.so/submit](https://mcp.so/submit).
2. Repository URL: `https://github.com/Adepoco/ClearRun`
3. Name: `ClearRun`
4. Review the name, description, config, and tools that the form fetches.
5. Submit for review. The same page offers a $39 one-time option that publishes without review. Pay only if you choose that option.
6. The site says a listing goes live after review.

## PulseMCP

1. Open [https://www.pulsemcp.com/submit](https://www.pulsemcp.com/submit).
2. On 28 October 2026 that page said new submissions and listing changes are paused. The page's own "last updated" line is 3 September 2026. It says to publish to the Official MCP Registry, and that PulseMCP will pick the server up when submissions reopen.
3. If the pause notice is still there, stop. Do not send a duplicate request. Finish the Official MCP Registry section above.
4. If the form is open again, submit `https://github.com/Adepoco/ClearRun` and the npm package `@clearrun/mcp`.

## punkpeye/awesome-mcp-servers

Repo: [https://github.com/punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers). Contributing: [CONTRIBUTING.md](https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md).

1. Finish the Glama listing first. The repo's bot asks for a Glama badge link and labels PRs that lack one.
2. Fork the repo and edit `README.md`.
3. Add the server under `### 💻 Developer Tools`. Put the line in alphabetical order by owner and repo (`Adepoco/ClearRun`).
4. Paste this line. Replace the two Glama URLs if the live listing slug is different. Legend used here: official vendor, TypeScript, cloud API.

```markdown
- [Adepoco/ClearRun](https://github.com/Adepoco/ClearRun) [![Adepoco/ClearRun MCP server](https://glama.ai/mcp/servers/Adepoco/ClearRun/badges/score.svg)](https://glama.ai/mcp/servers/Adepoco/ClearRun) 🎖️ 📇 ☁️ - Scores AI answers for honesty (whether confidence is backed by its reasoning). Not a fact-checker.
```

5. Open a pull request to `main`. One server, one line. Keep the description free of an em dash.

ClearRun is made by Adepoco, a California corporation. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).
