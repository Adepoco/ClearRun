// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// Shape a hosted API payload for an MCP tool result.
// Score and scoringVersion are copied only when the verdict actually has them.
// Receipt is copied only when the response actually has it.
// Nothing here is filled in when the API omits it.

import { isVerdict } from '@clearrun/core-types';

export { MISSING_API_KEY_MESSAGE as MISSING_KEY_MESSAGE } from '@clearrun/sdk';

export type HostedTool = 'score' | 'evaluate' | 'chat' | 'verify';

export interface HostedPresentation {
  isError: boolean;
  text: string;
  payload: Record<string, unknown>;
}

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

function asRecord(data: unknown): Record<string, unknown> | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  return data as Record<string, unknown>;
}

function answerOf(source: Record<string, unknown> | undefined): string | undefined {
  if (!source) return undefined;
  if (typeof source.responseText === 'string' && source.responseText.trim()) return source.responseText;
  if (typeof source.response === 'string' && source.response.trim()) return source.response;
  return undefined;
}

function document(payload: Record<string, unknown>, isError: boolean): HostedPresentation {
  return { isError, payload, text: JSON.stringify(payload, null, 2) };
}

/**
 * A hosted tool succeeds only when the body is a result a person can read.
 * `answered` is true when chat text is present. `scored` is true when `isVerdict` passes.
 * Anything else is a tool error, including a 200 body of {}.
 */
export function presentHostedCall(tool: HostedTool, data: unknown): HostedPresentation {
  const source = asRecord(data);
  const verdict = source?.verdict;
  const scored = isVerdict(verdict);
  const answer = answerOf(source);

  if (tool === 'score' || tool === 'evaluate') {
    if (!scored) {
      return document(
        {
          outcome: 'failed',
          answered: false,
          scored: false,
          error: 'ClearRun did not return a verdict.',
        },
        true
      );
    }
    return document(
      {
        ...presentApiResult(data),
        outcome: 'scored',
        answered: false,
        scored: true,
      },
      false
    );
  }

  if (tool === 'chat') {
    if (answer && scored) {
      return document(
        {
          ...presentApiResult(data),
          outcome: 'scored',
          answered: true,
          scored: true,
        },
        false
      );
    }
    if (answer) {
      return document(
        {
          outcome: 'answered',
          answered: true,
          scored: false,
          responseText: answer,
          error: 'ClearRun returned an answer but no verdict.',
        },
        true
      );
    }
    if (scored) {
      return document(
        {
          ...presentApiResult(data),
          outcome: 'scored',
          answered: false,
          scored: true,
          error: 'ClearRun returned a verdict but no answer.',
        },
        true
      );
    }
    return document(
      {
        outcome: 'failed',
        answered: false,
        scored: false,
        error: 'ClearRun did not return an answer or a verdict.',
      },
      true
    );
  }

  const verified = source?.verified;
  if (typeof verified !== 'boolean') {
    return document(
      {
        outcome: 'failed',
        answered: false,
        scored: false,
        error: 'ClearRun did not return a verification result.',
      },
      true
    );
  }
  if (verified && !scored) {
    return document(
      {
        outcome: 'failed',
        answered: false,
        scored: false,
        verified,
        error: 'ClearRun did not return a verdict.',
      },
      true
    );
  }
  if (!verified && verdict !== undefined && !scored) {
    return document(
      {
        outcome: 'failed',
        answered: false,
        scored: false,
        verified,
        error: 'ClearRun did not return a readable verdict.',
      },
      true
    );
  }
  if (!verified) {
    return document(
      {
        ...(scored ? presentApiResult(data) : {}),
        outcome: 'failed',
        answered: false,
        scored,
        verified,
        error: 'This verdict id did not verify.',
      },
      false
    );
  }
  return document(
    {
      ...presentApiResult(data),
      outcome: 'scored',
      answered: false,
      scored: true,
      verified,
    },
    false
  );
}
