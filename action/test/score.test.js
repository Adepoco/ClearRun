// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco
//
// Local tests for the action script. They do not call the network.

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { CLI_SPEC, COPY, parsePaths, run } = require('../score.js');
const { lint } = require('../../scripts/lint_action_yml.js');

const SECRET = 'crun_test_key_not_a_secret';
const FILE_KEY = 'crun_file_key_not_a_secret';

function workspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'clearrun-action-'));
  const env = {
    CLEARRUN_API_KEY: SECRET,
    INPUT_PATHS: 'answers/a.txt',
    INPUT_THRESHOLD: '70',
    INPUT_MAX_ISSUES: '',
    INPUT_CONFIG: '',
    INPUT_JSON: 'true',
    INPUT_REPORT_PATH: 'clearrun-report.json',
    GITHUB_OUTPUT: path.join(cwd, 'github-output.txt'),
    GITHUB_STEP_SUMMARY: path.join(cwd, 'summary.md'),
  };
  fs.writeFileSync(env.GITHUB_OUTPUT, '');
  fs.writeFileSync(env.GITHUB_STEP_SUMMARY, '');
  return { cwd, env };
}

function outputsOf(env) {
  const map = {};
  for (const line of fs.readFileSync(env.GITHUB_OUTPUT, 'utf8').split('\n')) {
    const index = line.indexOf('=');
    if (index === -1) continue;
    map[line.slice(0, index)] = line.slice(index + 1);
  }
  return map;
}

function verdict(score, id) {
  return {
    score,
    grade: 'GRADETOKEN',
    summary: 'SUMMARYTOKEN',
    issues: ['ISSUETOKEN'],
    verdictId: id,
    componentSignals: [{ name: 'SIGNALTOKEN', level: 1 }],
  };
}

function cliJson(body) {
  return JSON.stringify(body);
}

test('parsePaths splits lines and spaces', () => {
  assert.deepEqual(parsePaths(''), []);
  assert.deepEqual(parsePaths('a.txt'), ['a.txt']);
  assert.deepEqual(parsePaths('a.txt\n\n  b.md  '), ['a.txt', 'b.md']);
  assert.deepEqual(parsePaths('a.txt b.md'), ['a.txt', 'b.md']);
});

test('missing key does not run the CLI or print a key', () => {
  const { cwd, env } = workspace();
  env.CLEARRUN_API_KEY = '';
  let called = false;
  let out = '';
  let err = '';
  const code = run({
    cwd,
    env,
    stdout: (chunk) => {
      out += chunk;
    },
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      called = true;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(called, false);
  assert.equal(code, 1);
  assert.equal(out.includes('::add-mask::'), false);
  assert.match(err, /ClearRun API key is missing/);
  assert.equal(outputsOf(env).passed, 'false');
  assert.equal(outputsOf(env)['min-score'], '');
});

test('a key with a newline is rejected and not printed', () => {
  const { cwd, env } = workspace();
  env.CLEARRUN_API_KEY = `abc\n${SECRET}`;
  let out = '';
  let err = '';
  const code = run({
    cwd,
    env,
    stdout: (chunk) => {
      out += chunk;
    },
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      throw new Error('spawn should not run');
    },
  });
  assert.equal(code, 1);
  assert.equal(out.includes(SECRET), false);
  assert.equal(err.includes(SECRET), false);
  assert.equal(out.includes('::add-mask::'), false);
});

test('json false fails before the CLI', () => {
  const { cwd, env } = workspace();
  env.INPUT_JSON = 'false';
  let called = false;
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr() {},
    spawn() {
      called = true;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(called, false);
  assert.equal(code, 1);
});

test('bad threshold and max-issues fail before the CLI', () => {
  for (const [field, value] of [
    ['INPUT_THRESHOLD', '101'],
    ['INPUT_THRESHOLD', 'abc'],
    ['INPUT_MAX_ISSUES', '-1'],
    ['INPUT_MAX_ISSUES', '1.5'],
  ]) {
    const { cwd, env } = workspace();
    env[field] = value;
    let called = false;
    const code = run({
      cwd,
      env,
      stdout() {},
      stderr() {},
      spawn() {
        called = true;
        return { status: 0, stdout: '', stderr: '' };
      },
    });
    assert.equal(called, false);
    assert.equal(code, 1);
  }
});

test('no paths and no config fails before the CLI', () => {
  const { cwd, env } = workspace();
  env.INPUT_PATHS = '';
  let called = false;
  let err = '';
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      called = true;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(called, false);
  assert.equal(code, 1);
  assert.match(err, /No files to score/);
});

test('config paths are scored when the paths input is empty', () => {
  const { cwd, env } = workspace();
  env.INPUT_PATHS = '';
  env.INPUT_THRESHOLD = '';
  fs.writeFileSync(
    path.join(cwd, 'clearrun.config.json'),
    JSON.stringify({ paths: ['answers/from-config.txt'], apiKey: FILE_KEY })
  );
  const seen = {};
  let out = '';
  let err = '';
  const code = run({
    cwd,
    env,
    stdout: (chunk) => {
      out += chunk;
    },
    stderr: (chunk) => {
      err += chunk;
    },
    spawn(cmd, args) {
      seen.cmd = cmd;
      seen.args = args;
      return {
        status: 0,
        stdout: cliJson({
          passed: true,
          results: [{ input: 'answers/from-config.txt', passed: true, verdict: verdict(80, 'v-80') }],
        }),
        stderr: '',
      };
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(seen.args, ['-y', CLI_SPEC, 'score', '--json']);
  assert.equal(seen.args.includes('--api-key'), false);
  assert.equal(out.includes(FILE_KEY), false);
  assert.equal(err.includes(FILE_KEY), false);
  assert.equal(fs.readFileSync(path.join(cwd, 'clearrun.config.json'), 'utf8').includes(FILE_KEY), true);
});

test('max-issues overrides config in a file that drops the key', () => {
  const { cwd, env } = workspace();
  env.INPUT_MAX_ISSUES = '0';
  env.INPUT_THRESHOLD = '0';
  env.INPUT_CONFIG = 'ci/clearrun.config.json';
  fs.mkdirSync(path.join(cwd, 'ci'));
  fs.writeFileSync(
    path.join(cwd, 'ci/clearrun.config.json'),
    JSON.stringify({ paths: ['keep.txt'], threshold: 10, apiKey: FILE_KEY, maxIssues: 9 })
  );
  const seen = {};
  let err = '';
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr: (chunk) => {
      err += chunk;
    },
    spawn(cmd, args) {
      seen.args = args;
      const index = args.indexOf('--config');
      seen.overlayPath = args[index + 1];
      seen.overlay = JSON.parse(fs.readFileSync(seen.overlayPath, 'utf8'));
      return {
        status: 1,
        stdout: cliJson({
          passed: false,
          results: [
            {
              input: 'answers/a.txt',
              passed: false,
              verdict: verdict(10, 'v 10'),
              failures: ['score 10 is below threshold 0'],
            },
          ],
        }),
        stderr: `notice ${SECRET}`,
      };
    },
  });
  assert.equal(code, 1);
  assert.equal(seen.overlay.apiKey, undefined);
  assert.equal(seen.overlay.maxIssues, 0);
  assert.deepEqual(seen.overlay.paths, ['keep.txt']);
  assert.equal(fs.existsSync(seen.overlayPath), false);
  assert.equal(seen.args.includes('--threshold'), true);
  assert.equal(seen.args[seen.args.indexOf('--threshold') + 1], '0');
  assert.equal(seen.args.includes('--api-key'), false);
  assert.equal(JSON.stringify(seen.args).includes(SECRET), false);
  assert.equal(JSON.stringify(seen.args).includes(FILE_KEY), false);
  const original = JSON.parse(fs.readFileSync(path.join(cwd, 'ci/clearrun.config.json'), 'utf8'));
  assert.equal(original.apiKey, FILE_KEY);
  assert.equal(original.maxIssues, 9);
  const summary = fs.readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8');
  assert.equal(summary.includes(SECRET), false);
  assert.equal(summary.includes(FILE_KEY), false);
  assert.equal(err.includes(SECRET), false);
  assert.match(err, /notice \*\*\*/);
});

test('a passing run sets outputs, the summary table, and masks the key', () => {
  const { cwd, env } = workspace();
  env.INPUT_PATHS = 'answers/a.txt\nanswers/b.md';
  env.INPUT_REPORT_PATH = 'out/report.json';
  let out = '';
  let err = '';
  const code = run({
    cwd,
    env,
    stdout: (chunk) => {
      out += chunk;
    },
    stderr: (chunk) => {
      err += chunk;
    },
    spawn(cmd, args, options) {
      assert.equal(cmd, process.platform === 'win32' ? 'npx.cmd' : 'npx');
      assert.equal(args[0], '-y');
      assert.equal(args[1], CLI_SPEC);
      assert.deepEqual(args.slice(2, 5), ['score', 'answers/a.txt', 'answers/b.md']);
      assert.equal(args.includes('--json'), true);
      assert.equal(args.includes('--api-key'), false);
      assert.equal(options.env.CLEARRUN_API_KEY, SECRET);
      assert.equal(options.env.npm_config_update_notifier, 'false');
      assert.equal(env.npm_config_update_notifier, undefined);
      return {
        status: 0,
        stdout: cliJson({
          passed: true,
          results: [
            { input: 'answers/a.txt', passed: true, verdict: verdict(82, 'v-82') },
            { input: 'answers/b.md', passed: true, verdict: verdict(90, 'v-90') },
          ],
        }),
        stderr: '',
      };
    },
  });
  assert.equal(code, 0);
  assert.equal(out, `::add-mask::${SECRET}\n`);
  const got = outputsOf(env);
  assert.equal(got['min-score'], '82');
  assert.equal(got.passed, 'true');
  assert.equal(got['report-path'], 'out/report.json');
  const summary = fs.readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8');
  const report = fs.readFileSync(path.join(cwd, 'out/report.json'), 'utf8');
  assert.match(summary, /\| Input \| Score \| Result \| Verdict \|/);
  assert.match(summary, /82/);
  assert.match(summary, /\[View verdict\]\(https:\/\/api\.clearrun\.net\/api\/verify\/v-82\)/);
  assert.match(summary, /CLI version: 1\.2\.0/);
  assert.match(summary, /ClearRun score gate passed\. 2 of 2 inputs passed\. Minimum score: 82\./);
  assert.match(summary, /A score does not mean the answer is true\. ClearRun is not a fact-checker\./);
  for (const token of ['GRADETOKEN', 'SUMMARYTOKEN', 'ISSUETOKEN', 'SIGNALTOKEN', SECRET]) {
    assert.equal(summary.includes(token), false, token);
    assert.equal(err.includes(token), false, token);
  }
  assert.equal(report.includes(SECRET), false);
  assert.equal(JSON.parse(report).results[0].verdict.score, 82);
  assert.equal(JSON.parse(report).results[0].verdict.grade, 'GRADETOKEN');
});

test('a missed gate fails the step and keeps the lower score', () => {
  const { cwd, env } = workspace();
  let out = '';
  let err = '';
  const code = run({
    cwd,
    env,
    stdout: (chunk) => {
      out += chunk;
    },
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      return {
        status: 1,
        stdout: cliJson({
          passed: false,
          results: [
            {
              input: 'a|b.txt',
              passed: false,
              verdict: verdict(64, 'v-64'),
              failures: ['score 64 is below threshold 70'],
            },
            { input: 'ok.txt', passed: true, verdict: verdict(91, 'v-91') },
          ],
        }),
        stderr: '',
      };
    },
  });
  assert.equal(code, 1);
  const got = outputsOf(env);
  assert.equal(got.passed, 'false');
  assert.equal(got['min-score'], '64');
  const summary = fs.readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8');
  assert.match(summary, /a\\\|b\.txt/);
  assert.match(summary, /score 64 is below threshold 70/);
  assert.match(err, /ClearRun score gate failed\. 1 of 2 inputs missed the gate\./);
  assert.match(err, /Report: clearrun-report\.json/);
  assert.match(out, /::error::ClearRun score gate failed\. 1 of 2 inputs missed the gate\./);
  assert.equal(summary.includes('GRADETOKEN'), false);
  assert.equal(summary.includes(SECRET), false);
  assert.equal(out.includes(SECRET) === false || out.startsWith(`::add-mask::${SECRET}\n`), true);
  const rest = out.split('\n').filter((line) => line && !line.startsWith('::add-mask::'));
  assert.equal(rest.some((line) => line.includes(SECRET)), false);
});

test('exit code and JSON must agree', () => {
  const { cwd, env } = workspace();
  let err = '';
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      return {
        status: 0,
        stdout: cliJson({
          passed: false,
          results: [{ input: 'a.txt', passed: false, verdict: verdict(10, 'v-10'), error: 'boom' }],
        }),
        stderr: '',
      };
    },
  });
  assert.equal(code, 1);
  assert.match(err, /did not agree/);
  assert.equal(outputsOf(env).passed, 'false');
});

test('non JSON output is saved without the key', () => {
  const { cwd, env } = workspace();
  let err = '';
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      return { status: 1, stdout: `not-json ${SECRET}`, stderr: `err ${SECRET}` };
    },
  });
  assert.equal(code, 1);
  const report = fs.readFileSync(path.join(cwd, 'clearrun-report.json'), 'utf8');
  assert.equal(report.includes(SECRET), false);
  assert.match(report, /\*\*\*/);
  assert.equal(err.includes(SECRET), false);
  assert.match(err, /did not return JSON/);
});

test('a report path outside the workspace is rejected', () => {
  const { cwd, env } = workspace();
  env.INPUT_REPORT_PATH = '../outside.json';
  let called = false;
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr() {},
    spawn() {
      called = true;
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(called, false);
  assert.equal(code, 1);
});

test('missing config path fails before the CLI', () => {
  const { cwd, env } = workspace();
  env.INPUT_CONFIG = 'missing.json';
  let err = '';
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      throw new Error('spawn should not run');
    },
  });
  assert.equal(code, 1);
  assert.match(err, /Config file not found: missing\.json/);
});

test('npx missing is a clear failure', () => {
  const { cwd, env } = workspace();
  let err = '';
  const code = run({
    cwd,
    env,
    stdout() {},
    stderr: (chunk) => {
      err += chunk;
    },
    spawn() {
      return { status: null, error: Object.assign(new Error('spawn npx ENOENT'), { code: 'ENOENT' }) };
    },
  });
  assert.equal(code, 1);
  assert.equal(err.trim(), COPY.npxMissing);
});

test('action metadata lint passes', () => {
  const result = lint(path.resolve(__dirname, '../..'));
  assert.equal(result.ok, true, result.errors.join('\n'));
});
