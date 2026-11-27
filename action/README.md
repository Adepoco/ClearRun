# ClearRun score gate

Score AI answer files in a GitHub Actions job. The step fails when a score misses the gate you set.

ClearRun is not a fact-checker. A high score means the confidence matches the reasoning. It does not mean the answer is true.

CI gate guide: [https://clearrun.net/ci-gate](https://clearrun.net/ci-gate)

This action runs `npx -y @clearrun/cli@1.2.0 score`. It sets up Node.js 20 for this step and the later steps in the job, passes your files to that pinned CLI, and reads the JSON result. The CLI calls `POST /api/score` on `https://api.clearrun.net`.

## Usage

Create a repository secret named `CLEARRUN_API_KEY`. The value is a ClearRun API key from [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). The action reads that secret from the `api-key` input and does not print it. The action does not read `GITHUB_TOKEN`.

```yaml
name: Score answers
on: [push]
jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Adepoco/clearrun-action@v1
        id: clearrun
        with:
          paths: |
            answers/one.txt
            answers/two.md
          threshold: '70'
          max-issues: '3'
          api-key: ${{ secrets.CLEARRUN_API_KEY }}

      - name: Show the minimum score
        if: always()
        run: echo "min ${{ steps.clearrun.outputs.min-score }} passed ${{ steps.clearrun.outputs.passed }}"
```

Pin `@v1` for the current 1.x action. Pin `@v1.0.0` when you want this exact action release. The CLI inside this release stays `@clearrun/cli@1.2.0`.

`runs-on` is your choice. The example uses `ubuntu-latest`.

A config file works the same way as `clearrun score`:

```yaml
- uses: Adepoco/clearrun-action@v1
  with:
    config: ci/clearrun.config.json
    threshold: '75'
    api-key: ${{ secrets.CLEARRUN_API_KEY }}
```

With no `paths` input, the CLI scores the `paths` in the config file. Paths in that file are relative to the file. Directories include `.txt` and `.md` files. Dot folders and `node_modules` are skipped.

## Inputs

| Input | Required | Default | What it does |
| --- | --- | --- | --- |
| `api-key` | yes |  | ClearRun API key. Pass `secrets.CLEARRUN_API_KEY`. The action never prints it. |
| `paths` | no | empty | Files or directories to score, one path per line. A single line can list several paths separated by spaces. When this is empty, the config file `paths` are used. |
| `threshold` | no | empty | Fail the step if any input scores below this number, from 0 to 100. Overrides the config file. A missing score fails when a threshold is set. |
| `max-issues` | no | empty | Fail the step if any input has more issues than this whole number (0 or more). Overrides the config file. |
| `config` | no | `clearrun.config.json` when that file exists | Path to a ClearRun config file. |
| `json` | no | `true` | Must stay `true`. The action reads CLI JSON for the summary, the minimum score, and the report. |
| `report-path` | no | `clearrun-report.json` | Workspace path for the JSON report. The path must stay inside the workspace. |

The CLI reads `maxIssues` from a config file, not from its own flag. When you set `max-issues`, the action writes a config file for this step, sets that limit, and deletes the file before the step ends. `apiKey` is left out of that file. The key stays in `CLEARRUN_API_KEY` for the CLI process and is not placed on the command line.

The step exits 1 when the gate fails, when the CLI exits 1, or when the JSON result does not agree with the exit code. Outputs are still set. A later step can read them with `if: always()`.

## Outputs

| Output | What it is |
| --- | --- |
| `min-score` | Lowest numeric score across inputs. Empty when no input returned a numeric score. |
| `passed` | `true` when every input passed the gate. `false` when any input missed it or the run failed. |
| `report-path` | Workspace path of the JSON report. Empty when the step failed before the CLI wrote one. |

The job summary has a table with the input, the score, passed or failed, and a verdict link. The link is `https://api.clearrun.net/api/verify/` plus the verdict id. The summary shows the CLI version. It does not print the API key.

## Cost

Each scored input spends ClearRun API credits. A directory is one input per `.txt` or `.md` file the CLI scores, and each of those files spends credits. On the public pricing page, a score costs at least 3 credits. Current prices: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

The job uses the runner you set with `runs-on`. Those minutes are your GitHub Actions minutes. This action does not start a runner of its own.

## What a score means

ClearRun is not a fact-checker. A high score means the confidence matches the reasoning. It does not mean the answer is true.

More on the gate: [https://clearrun.net/ci-gate](https://clearrun.net/ci-gate).

## License

MIT. The hosted scoring service is licensed separately.

ClearRun is made by Adepoco. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).
