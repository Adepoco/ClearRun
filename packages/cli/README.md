# @clearrun/cli

## Get an API key

Hosted scoring needs a ClearRun account and an API key. Keys are a Pro plan or higher feature. A free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

1. Open [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). Sign in on that page if you need an account. That page is where you create a key.
2. Save the key:

```bash
npx @clearrun/cli login
```

Or set `CLEARRUN_API_KEY`. Do not commit a real key.

Lookup order: `--api-key`, then `CLEARRUN_API_KEY`, then `~/.config/clearrun/config.json` from `clearrun login`, then `apiKey` in `./clearrun.config.json`. `XDG_CONFIG_HOME/clearrun/config.json` is used when `XDG_CONFIG_HOME` is set. The file is mode 0600. `clearrun whoami` prints a masked key. `clearrun logout` removes the saved key.

`clearrun login` saves the key on this machine. It does not send the key to the API. The scoring routes spend credits, and the account routes use a browser session, so there is no free key check.

The first time you run the CLI with no key configured, it prints this same hint once.

Command line for [ClearRun](https://clearrun.net). Version 0.2.0. The `clearrun` command scores AI answer text through the hosted API at `https://api.clearrun.net`.

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

This package does not contain scoring logic, weights, or formulas. It sends `responseText` to `POST /api/score` and prints the public verdict.

`clearrun verify` scores text. It does not look up an existing verdict id. To look one up, use `GET /api/verify/{id}` below.

## Why use it

Score a file, a directory of drafts, or a string in CI. Set a threshold so the process exits 1 when a score is too low or there are too many issues. Use `--json` when another program will read the result.

## Access

See **Get an API key** above. `clearrun verify` exits 1 with that message when no key is configured, and it does not call the API.

## Install

```bash
npm install -g @clearrun/cli
clearrun --version
```

Or run it without a global install:

```bash
npx @clearrun/cli --help
```

Node.js 18 or newer is required.

## Quickstart

```bash
npx @clearrun/cli login
clearrun verify --text "The Eiffel Tower is in Berlin."
```

`export CLEARRUN_API_KEY=YOUR_CLEARRUN_API_KEY` works too, and it overrides the saved key.

Score a file:

```bash
clearrun verify answer.txt
```

## Commands

```text
clearrun login                        Open the API key page and save a key
clearrun logout                       Remove the saved key
clearrun whoami                       Show whether a key is configured (masked)
clearrun verify <file> [<file> ...]   Score one or more files
clearrun verify --text "..."          Score inline text
clearrun verify                       Score the "paths" in clearrun.config.json
clearrun --help                       Show help
clearrun --version                    Show the CLI version (0.2.0)
```

With no command, `clearrun` prints help and exits 0.

### Options

| Option | What it does |
| --- | --- |
| `--api-key <key>` | API key. Overrides `CLEARRUN_API_KEY` and both config files. |
| `--base-url <url>` | API base URL. Default `https://api.clearrun.net`. |
| `--config <path>` | Config file. Default `./clearrun.config.json`. Paths inside the file are relative to that file. |
| `--threshold <0-100>` | Exit 1 if any input scores below this, or has no score. Overrides the config value. |
| `--json` | Print the verdict as JSON. With more than one input, print one object per input, including whether it passed. |

### Examples

```bash
clearrun verify response.txt --json
clearrun verify responses/ answer.txt
clearrun verify --config ci/clearrun.config.json --threshold 75
```

### Config file

`clearrun.config.json`, every field optional:

```json
{
  "paths": ["responses/", "answer.txt"],
  "threshold": 70,
  "maxIssues": 3,
  "baseUrl": "https://api.clearrun.net"
}
```

`clearrun verify` with no file and no `--text` scores every `.txt` and `.md` file under `paths`. Directories are walked recursively. Dot folders and `node_modules` are skipped. A run also exits 1 when an input has more issues than `maxIssues`.

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Every input scored, and each one met `threshold` and `maxIssues`. |
| 1 | An input missed the gate, a request failed, or the usage was wrong. |

Printed text includes the score, grade, risk, issues, and summary. `--json` prints the verdict fields the API returned for that call: `score`, `grade`, `risk`, `issues`, `summary`, `verdictId`, `timestamp`, and `signature` when present.

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 26 credits per turn. This CLI calls score, so each input costs at least 3 credits. The CLI does not call chat. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Verify a verdict

Scoring returns a `verdictId`. Anyone can check that record later. No API key is required:

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

The lookup confirms the stored verdict. It does not fact-check the original answer. It does not run `clearrun verify` again.

## Links

- npm: [https://www.npmjs.com/package/@clearrun/cli](https://www.npmjs.com/package/@clearrun/cli)
- GitHub: [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun)
- Site: [https://clearrun.net](https://clearrun.net)
- Pricing: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)
- API keys: [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)
- SDK: [https://www.npmjs.com/package/@clearrun/sdk](https://www.npmjs.com/package/@clearrun/sdk)
- MCP: [https://www.npmjs.com/package/@clearrun/mcp](https://www.npmjs.com/package/@clearrun/mcp)
- Developer guide: [docs/developers.md](https://github.com/Adepoco/ClearRun/blob/main/docs/developers.md)

ClearRun is made by Adepoco, a California corporation. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).

## License

MIT. The hosted scoring service is licensed separately.
