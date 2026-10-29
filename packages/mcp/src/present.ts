// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// Shape a hosted API payload for an MCP tool result.
// Score and scoringVersion are copied only when the verdict actually has them.
// Receipt is copied only when the response actually has it.
// Nothing here is filled in when the API omits it.

export { MISSING_API_KEY_MESSAGE as MISSING_KEY_MESSAGE } from '@clearrun/sdk';

export function redactSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('[redacted]');
}

export function presentApiResult(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {};
  }

  const source = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const verdict = source.verdict;

  if (typeof verdict === 'object' && verdict !== null && !Array.isArray(verdict)) {
    const fields = verdict as Record<string, unknown>;
    if ('score' in fields) out.score = fields.score;
    if ('scoringVersion' in fields) out.scoringVersion = fields.scoringVersion;
    out.verdict = verdict;
  }

  if ('receipt' in source) out.receipt = source.receipt;

  for (const [key, value] of Object.entries(source)) {
    if (key === 'verdict' || key === 'receipt') continue;
    if (!(key in out)) out[key] = value;
  }

  return out;
}
