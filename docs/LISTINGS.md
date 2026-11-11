# Listing checklist

Submit `@clearrun/mcp` after the package people will install is the one you describe. The server in this repository is stdio, npm package `@clearrun/mcp` 1.2.0, started with `npx -y @clearrun/mcp`. `CLEARRUN_API_KEY` is a secret for `clearrun_score`, `clearrun_evaluate`, and `clearrun_chat`. `clearrun_verify` does not read it, so [packages/mcp/server.json](../packages/mcp/server.json) sets `isRequired` to false. npm serves `@clearrun/sdk`, `@clearrun/cli`, `@clearrun/mcp`, and `@clearrun/core-types` at 1.2.0, and both `server.json` version fields are 1.2.0. Publish the registry manifest for that published 1.2.0 tarball. Do not publish it against 0.2.0, 0.3.0, or 0.1.1. `@clearrun/mcp@0.2.0` (published 2026-10-29) still requires a key for `clearrun_verify`. `@clearrun/mcp@0.3.0` is published and still depends on `@clearrun/core-types` ^0.1.0. This repository does not run `npm publish` or the registry publish.

A signed-in free account with a verified email can create one developer key at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). The full key is shown once and starts with `crun_`. It calls evaluate, score, and chat, and it returns the free verdict: score, grade, risk, and a summary of 16 words or fewer. `componentSignals` is limited to Evidence support and Reasoning integrity. `confidenceInterval` and `scoringVersion` are omitted. Calls spend the free plan's 30 monthly credits. The default cap is 2 requests a second, 6 a minute, 30 an hour, and 40 a day. Evaluate, score, and chat share that cap. Over the cap, the API returns 429 and `Retry-After`. Signed-in chat and Paste Check on api.clearrun.net do not use the key. Chain verification and audit export need a Pro plan or higher. An unverified account cannot create a key. A free account can hold one active developer key. Revoke it before creating another. A key that is not a free developer key is refused on a free account with 403 and code `API_ACCESS_REQUIRED`. On Pro, Business, and Enterprise, API access is a saved setting. Turning it off returns 403 and code `API_ACCESS_DISABLED`. That switch does not turn a free developer key on or off.

Directory forms checked 28 October 2026. Re-open each form before you submit. Pages change. Version and free developer key facts checked 11 November 2026 against npm and [https://api.clearrun.net/developers](https://api.clearrun.net/developers).

One-line description you can reuse:

```text
Scores AI answers for honesty (whether confidence is backed by its reasoning). Not a fact-checker.
```

## Official MCP Registry

Do this before PulseMCP. The manifest is [packages/mcp/server.json](../packages/mcp/server.json). `mcpName` in [packages/mcp/package.json](../packages/mcp/package.json) is `io.github.adepoco/clearrun-mcp`. That name matches `server.json`. Schema: `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`. Docs: [registry quickstart](https://modelcontextprotocol.io/registry/quickstart).

`mcpName` is read from the **published** npm package. npm `@clearrun/mcp@0.1.1` does not contain it. This repo is 1.2.0 in `package.json` and in both `server.json` version fields. npm `@clearrun/mcp@1.2.0` is published and depends on `@clearrun/sdk` ^1.2.0 and `@clearrun/core-types` ^1.2.0. npm `@clearrun/mcp@0.3.0` is still published and still depends on `@clearrun/core-types` ^0.1.0. npm `@clearrun/mcp@0.2.0` (published 2026-10-29) still requires an API key for `clearrun_verify`. `server.json` in this repository says the key is not required, because the source tool does not use it. Do not publish this manifest against 0.3.0, 0.2.0, or 0.1.1. Those tarballs do not implement it. npm 1.2.0 is already published. Publish the registry manifest for 1.2.0.

This repository does not run `npm publish` or `mcp-publisher publish`.

```bash
# 1.2.0 is already on npm. Confirm it, then publish the registry manifest.
# package.json and both server.json version fields are 1.2.0.
# Do not publish 1.2.0 again. This repository does not run npm publish.
curl -s https://registry.npmjs.org/@clearrun/mcp/1.2.0 | jq -r .mcpName
# Expected output: io.github.adepoco/clearrun-mcp

# Later version only. From the repository root, after that version is the commit you intend to publish.
# @clearrun/sdk must be on npm before @clearrun/cli and @clearrun/mcp.
# mcpName stays io.github.adepoco/clearrun-mcp.
# Publish to npm (npm account with access to @clearrun). Do not use a CI token in the shell history you share.
# npm publish --access public -w @clearrun/sdk
# npm publish --access public -w @clearrun/cli
# npm publish --access public -w @clearrun/mcp

# Install mcp-publisher:
# https://modelcontextprotocol.io/registry/quickstart
# Log in from packages/mcp.
cd packages/mcp
mcp-publisher login github
mcp-publisher publish
```

`mcp-publisher login github` (the device flow) grants your personal GitHub namespace only. It does not grant `io.github.adepoco/*`. Current registry auth docs say an organization Owner must prove the org role with a personal access token, or publish from GitHub Actions via OIDC. Tracking issue: [modelcontextprotocol/registry#1468](https://github.com/modelcontextprotocol/registry/issues/1468).

For the Adepoco organization, from `packages/mcp`, an Owner runs:

```bash
mcp-publisher login github --token "$GITHUB_TOKEN"
mcp-publisher publish
```

Use a classic PAT with the `read:org` scope, or a fine-grained PAT on the Adepoco organization with Organization permissions, Members, Read-only. Do not commit the token. Do not give it repository scopes. You must be an Owner of the GitHub organization `Adepoco`, not only a member.

If publish returns 403 and the permission it names is `io.github.Adepoco/*`, the registry is matching the GitHub login casing (`Adepoco`) and the check is case-sensitive ([registry#689](https://github.com/modelcontextprotocol/registry/issues/689)). Change `mcpName` and `server.json` `name` to `io.github.Adepoco/clearrun-mcp`, publish that npm version, then run `mcp-publisher publish` again. The two strings must match exactly.

Confirm:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.adepoco/clearrun-mcp"
```

## Smithery

Docs: [https://smithery.ai/docs/build/publish](https://smithery.ai/docs/build/publish).

This server is local stdio. The URL flow at [https://smithery.ai/new](https://smithery.ai/new) is for a public HTTPS Streamable HTTP server, so it does not fit `@clearrun/mcp`.

1. Build an MCPB bundle for the stdio server. Smithery's page points at Anthropic's MCPB guide for the bundle format. This repo does not ship a bundle yet.
2. Publish the bundle: `smithery mcp publish ./server.mcpb -n adepoco/clearrun-mcp`
3. Finish the publishing flow on Smithery. The page also has a bundle upload API if you are not using the CLI.
4. Open the server's Settings, then Verification, if you want the official-vendor check.

## Glama

The [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) bot tells submitters to list on Glama first, at [https://glama.ai/mcp/servers](https://glama.ai/mcp/servers).

1. Sign in at [https://glama.ai](https://glama.ai).
2. Submit the GitHub repository [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun). If the form asks for a subdirectory, use `packages/mcp`.
3. Wait until the listing URL loads. The badge URL the awesome list uses looks like `https://glama.ai/mcp/servers/Adepoco/ClearRun`.
4. Their bot has asked for a successful Docker image build and a GitHub release. If the current checks still require those, a release tag and an image are needed before the listing passes. Confirm on the Glama page. This checklist could not open a separate submit form; `https://glama.ai/mcp/servers/new` is a search page, not a form.

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
