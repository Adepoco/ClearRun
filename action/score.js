// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco
//
// Runs the pinned ClearRun CLI for the composite action.
// Writes step outputs and a job summary. Does not print the API key.

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI_SPEC = '@clearrun/cli@1.2.0';
const CLI_VERSION = '1.2.0';
const VERIFY_ROOT = 'https://api.clearrun.net/api/verify/';

const COPY = {
  missingKey: 'ClearRun API key is missing. Set the api-key input to secrets.CLEARRUN_API_KEY.',
  jsonRequired: 'Set json to true. This action reads the CLI JSON to set outputs and the job summary.',
  badThreshold: 'threshold must be a number from 0 to 100.',
  badMaxIssues: 'max-issues must be a whole number, 0 or more.',
  badReportPath: 'report-path must be a relative path inside the workspace.',
  noFiles: 'No files to score. Set paths, or add paths to the config file.',
  configObject: 'Config file must contain a JSON object.',
  npxMissing: 'npx was not found. The Set up Node.js step did not put Node on PATH.',
  notJson: 'ClearRun did not return JSON. The report file has the raw output.',
  tooLarge: 'The CLI output was larger than 10 MB.',
  couldNotStart: 'The CLI could not be started.',
  disagree: 'The CLI exit code and the JSON result did not agree. The step is failed.',
  notFactChecker: 'A score does not mean the answer is true. ClearRun is not a fact-checker.',
  viewVerdict: 'View verdict',
  heading: 'ClearRun score gate',
};

function redact(text, secret) {
  const value = String(text ?? '');
  if (!secret) return value;
  return value.split(secret).join('***');
}

function parsePaths(raw) {
  if (raw === undefined || raw === null) return [];
  const paths = [];
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const part of trimmed.split(/\s+/)) {
      if (part) paths.push(part);
    }
  }
  return paths;
}

function parseThreshold(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return { unset: true };
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return { error: COPY.badThreshold };
  return { value: n };
}

function parseMaxIssues(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return { unset: true };
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return { error: COPY.badMaxIssues };
  return { value: Number(s) };
}

function wantsJson(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return true;
  return /^(true|1|yes)$/i.test(String(raw).trim());
}

function isInsideWorkspace(cwd, target) {
  const base = path.resolve(cwd);
  const abs = path.resolve(target);
  const rel = path.relative(base, abs);
  if (!rel || rel === '') return false;
  if (rel === '..' || rel.startsWith(`..${path.sep}`)) return false;
  if (path.isAbsolute(rel)) return false;
  return true;
}

function configMissing(rel) {
  return `Config file not found: ${rel}`;
}

function configJson(rel) {
  return `Config file is not valid JSON: ${rel}`;
}

function readConfig(cwd, configInput) {
  const explicit = String(configInput || '').trim();
  const rel = explicit || 'clearrun.config.json';
  const full = path.resolve(cwd, rel);
  if (!fs.existsSync(full)) {
    if (explicit) return { error: configMissing(explicit) };
    return { config: null, file: null, rel: null };
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return { error: configJson(rel) };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: COPY.configObject };
  }
  return { config: raw, file: full, rel };
}

function writeOverlay(config, maxIssues) {
  const body = config ? { ...config } : {};
  delete body.apiKey;
  body.maxIssues = maxIssues;
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const file = path.join(os.tmpdir(), `clearrun-action-${suffix}.json`);
  fs.writeFileSync(file, JSON.stringify(body), { mode: 0o600 });
  return file;
}

function minScoreOf(results) {
  let min = null;
  for (const row of results) {
    const score = row && row.verdict ? row.verdict.score : undefined;
    if (typeof score === 'number' && Number.isFinite(score)) {
      min = min === null ? score : Math.min(min, score);
    }
  }
  return min;
}

function verdictHref(verdict) {
  const id = verdict && typeof verdict.verdictId === 'string' ? verdict.verdictId.trim() : '';
  if (!id) return '';
  return VERIFY_ROOT + encodeURIComponent(id);
}

function cell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function buildSummary(state) {
  const lines = [
    `## ${COPY.heading}`,
    '',
    `Result: ${state.passed ? 'passed' : 'failed'}`,
    `CLI version: ${CLI_VERSION}`,
    `Minimum score: ${state.minScore === null || state.minScore === undefined ? 'none' : state.minScore}`,
  ];
  if (state.reportPath) lines.push(`Report: ${state.reportPath}`);
  lines.push('');
  if (state.rows && state.rows.length) {
    lines.push('| Input | Score | Result | Verdict |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of state.rows) {
      const verdict = row.href ? `[${COPY.viewVerdict}](${row.href})` : '';
      lines.push(`| ${cell(row.input)} | ${cell(row.score)} | ${cell(row.result)} | ${verdict} |`);
    }
    lines.push('');
  }
  if (state.log) {
    lines.push(state.log.trim());
    lines.push('');
  }
  lines.push(COPY.notFactChecker);
  lines.push('');
  return lines.join('\n');
}

function workflowEscape(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function oneLine(text) {
  return String(text).replace(/\s*\n+\s*/g, ' ').trim();
}

function writeOutputs(env, state) {
  if (!env.GITHUB_OUTPUT) return;
  const min = state.minScore === null || state.minScore === undefined ? '' : String(state.minScore);
  const report = state.reportPath || '';
  fs.appendFileSync(
    env.GITHUB_OUTPUT,
    `min-score=${min}\npassed=${state.passed ? 'true' : 'false'}\nreport-path=${report}\n`
  );
}

function writeSummaryFile(env, markdown) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY, markdown.endsWith('\n') ? markdown : `${markdown}\n`);
}

function failureState(message) {
  return {
    exitCode: 1,
    passed: false,
    minScore: null,
    reportPath: '',
    rows: [],
    details: [],
    headline: message,
    log: message,
  };
}

function parseCliJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    /* The CLI document is the JSON object. A tool banner may sit in front of it. */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function rowView(row) {
  const input = row && typeof row.input === 'string' && row.input ? row.input : '(input)';
  const score = row && row.verdict && typeof row.verdict.score === 'number' && Number.isFinite(row.verdict.score)
    ? String(row.verdict.score)
    : 'none';
  const passed = Boolean(row && row.passed === true);
  return {
    input,
    score,
    result: passed ? 'passed' : 'failed',
    href: verdictHref(row && row.verdict),
  };
}

function detailLines(results) {
  const lines = [];
  for (const row of results) {
    const input = row && typeof row.input === 'string' && row.input ? row.input : '(input)';
    if (row && typeof row.error === 'string' && row.error.trim()) lines.push(`${input}: ${row.error.trim()}`);
    if (row && Array.isArray(row.failures)) {
      for (const failure of row.failures) {
        if (typeof failure === 'string' && failure.trim()) lines.push(`${input}: ${failure.trim()}`);
      }
    }
  }
  return lines;
}

function defaultSpawn(cmd, args, options) {
  return spawnSync(cmd, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
}

function run(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const stdout = options.stdout || ((chunk) => process.stdout.write(chunk));
  const stderr = options.stderr || ((chunk) => process.stderr.write(chunk));
  const spawn = options.spawn || defaultSpawn;
  const key = typeof env.CLEARRUN_API_KEY === 'string' ? env.CLEARRUN_API_KEY : '';
  let overlay = null;

  const finish = (state) => {
    if (overlay) {
      try {
        fs.unlinkSync(overlay);
      } catch {
        /* The overlay is a config file for this step. Missing it is fine. */
      }
      overlay = null;
    }
    state.headline = redact(state.headline, key);
    state.log = redact(state.log, key);
    state.details = (state.details || []).map((line) => redact(line, key));
    writeOutputs(env, state);
    writeSummaryFile(env, buildSummary(state));
    if (state.exitCode !== 0) stdout(`::error::${workflowEscape(oneLine(state.headline))}\n`);
    const reportLine = state.reportPath ? `Report: ${state.reportPath}\n` : '';
    stderr(`${state.log}\n${reportLine}`);
    return state.exitCode;
  };

  try {
    if (!key.trim() || /[\r\n]/.test(key)) return finish(failureState(COPY.missingKey));
    // The runner consumes this workflow command and does not show the value.
    stdout(`::add-mask::${key}\n`);

    if (!wantsJson(env.INPUT_JSON)) return finish(failureState(COPY.jsonRequired));

    const threshold = parseThreshold(env.INPUT_THRESHOLD);
    if (threshold.error) return finish(failureState(threshold.error));
    const maxIssues = parseMaxIssues(env.INPUT_MAX_ISSUES);
    if (maxIssues.error) return finish(failureState(maxIssues.error));

    const reportRel = String(env.INPUT_REPORT_PATH || 'clearrun-report.json').trim();
    if (!reportRel || /[\r\n]/.test(reportRel)) return finish(failureState(COPY.badReportPath));
    const reportAbs = path.resolve(cwd, reportRel);
    if (!isInsideWorkspace(cwd, reportAbs)) return finish(failureState(COPY.badReportPath));

    const paths = parsePaths(env.INPUT_PATHS);
    const loaded = readConfig(cwd, env.INPUT_CONFIG);
    if (loaded.error) return finish(failureState(loaded.error));

    const configPaths = loaded.config && Array.isArray(loaded.config.paths) ? loaded.config.paths : [];
    const configPathsInvalid = Boolean(loaded.config && loaded.config.paths !== undefined && !Array.isArray(loaded.config.paths));
    if (paths.length === 0 && configPaths.length === 0 && !configPathsInvalid) return finish(failureState(COPY.noFiles));

    let configFlag = '';
    if (!maxIssues.unset) {
      overlay = writeOverlay(loaded.config, maxIssues.value);
      configFlag = overlay;
    } else if (String(env.INPUT_CONFIG || '').trim()) {
      configFlag = String(env.INPUT_CONFIG).trim();
    }

    const args = ['-y', CLI_SPEC, 'score'];
    for (const file of paths) args.push(file);
    if (!threshold.unset) args.push('--threshold', String(threshold.value));
    if (configFlag) args.push('--config', configFlag);
    args.push('--json');

    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const childEnv = Object.assign({}, env, { npm_config_update_notifier: 'false' });
    const result = spawn(npx, args, { cwd, env: childEnv });
    const status = result ? result.status : null;

    if (typeof status !== 'number') {
      const code = result && result.error && result.error.code ? String(result.error.code) : '';
      if (code === 'ENOENT') return finish(failureState(COPY.npxMissing));
      if (/MAXBUFFER/i.test(code)) return finish(failureState(COPY.tooLarge));
      const detail = result && result.error && result.error.message ? result.error.message : COPY.couldNotStart;
      return finish(failureState(`ClearRun score gate failed. ${detail}`));
    }

    fs.mkdirSync(path.dirname(reportAbs), { recursive: true });
    const parsed = parseCliJson(result.stdout);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fs.writeFileSync(reportAbs, redact(String(result.stdout || ''), key));
      const state = failureState(COPY.notJson);
      state.reportPath = reportRel;
      const cliErr = redact(String(result.stderr || '').trim(), key);
      if (cliErr) state.log = `${COPY.notJson}\n${cliErr}`;
      return finish(state);
    }

    const reportBody = redact(`${JSON.stringify(parsed, null, 2)}\n`, key);
    fs.writeFileSync(reportAbs, reportBody);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    const rows = results.map(rowView);
    const details = detailLines(results);
    const minScore = minScoreOf(results);
    const jsonPassed = parsed.passed === true && results.length > 0 && results.every((row) => row && row.passed === true);
    const cliPassed = status === 0;
    const passed = jsonPassed && cliPassed;
    const failedCount = results.filter((row) => !row || row.passed !== true).length;
    const passedCount = results.length - failedCount;
    const minLabel = minScore === null ? 'none' : String(minScore);

    let headline;
    if (passed) {
      headline = `ClearRun score gate passed. ${passedCount} of ${results.length} inputs passed. Minimum score: ${minLabel}.`;
    } else if (typeof parsed.error === 'string' && parsed.error.trim() && results.length === 0) {
      headline = `ClearRun score gate failed. ${parsed.error.trim()}`;
    } else if (results.length === 0) {
      headline = 'ClearRun score gate failed.';
    } else {
      headline = `ClearRun score gate failed. ${failedCount} of ${results.length} inputs missed the gate.`;
    }

    const logParts = [headline];
    if (!passed && jsonPassed !== cliPassed) logParts.push(COPY.disagree);
    for (const detail of details) logParts.push(detail);
    const cliErr = String(result.stderr || '').trim();
    if (cliErr) logParts.push(cliErr);

    const state = {
      exitCode: passed ? 0 : 1,
      passed,
      minScore,
      reportPath: reportRel,
      rows,
      details: passed ? [] : details,
      headline,
      log: logParts.join('\n'),
    };
    return finish(state);
  } catch (err) {
    const message = err && err.message ? err.message : 'ClearRun score gate failed.';
    return finish(failureState(`ClearRun score gate failed. ${message}`));
  }
}

module.exports = {
  CLI_SPEC,
  CLI_VERSION,
  COPY,
  parsePaths,
  parseThreshold,
  parseMaxIssues,
  buildSummary,
  redact,
  run,
};

if (require.main === module) {
  try {
    process.exit(run());
  } catch (err) {
    const key = typeof process.env.CLEARRUN_API_KEY === 'string' ? process.env.CLEARRUN_API_KEY : '';
    const message = redact(err && err.message ? err.message : 'ClearRun score gate failed.', key);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
