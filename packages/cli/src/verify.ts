// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// CLI adapter over @clearrun/sdk. Scoring and lookup both go through that
// client. This file does not call fetch on its own.

import {
  createKernelClient,
  createVerifyClient,
  isVerdict,
  type FetchLike,
  type Verdict,
} from '@clearrun/sdk';

export interface PublicVerdict {
  score: number | null;
  grade: string;
  risk: 'low' | 'moderate' | 'elevated' | 'high';
  issues: string[];
  summary: string;
  verdictId: string;
  timestamp: string;
  signature?: string;
}

export interface VerifyOptions {
  baseUrl?: string;
  apiKey?: string;
  fetch?: FetchLike;
}

export interface LookupResult {
  verified: boolean;
  verdict?: PublicVerdict;
}

export const NO_VERDICT_MESSAGE = 'ClearRun did not return a verdict.';
export const NO_VERIFY_MESSAGE = 'ClearRun did not return a verification result.';

export async function scoreText(text: string, options?: VerifyOptions): Promise<PublicVerdict> {
  const client = createKernelClient({
    hosted: {
      apiKey: options?.apiKey,
      baseUrl: options?.baseUrl,
    },
    deps: options?.fetch ? { fetch: options.fetch } : undefined,
    // The CLI passes the key it already resolved. Do not read a second key here.
    env: {},
  });
  const data = await client.score({ responseText: text });
  if (!isVerdict(data.verdict)) {
    throw new Error(NO_VERDICT_MESSAGE);
  }
  return toPublicVerdict(data.verdict);
}

export async function lookupVerdict(verdictId: string, options?: VerifyOptions): Promise<LookupResult> {
  const client = createVerifyClient({
    baseUrl: options?.baseUrl,
    deps: options?.fetch ? { fetch: options.fetch } : undefined,
  });
  const data = await client.verify({ verdictId });
  if (typeof data.verified !== 'boolean') {
    throw new Error(NO_VERIFY_MESSAGE);
  }
  if (data.verified) {
    if (!isVerdict(data.verdict)) throw new Error(NO_VERDICT_MESSAGE);
    return { verified: data.verified, verdict: toPublicVerdict(data.verdict) };
  }
  if (data.verdict !== undefined && !isVerdict(data.verdict)) {
    throw new Error(NO_VERDICT_MESSAGE);
  }
  return isVerdict(data.verdict)
    ? { verified: data.verified, verdict: toPublicVerdict(data.verdict) }
    : { verified: data.verified };
}

function toPublicVerdict(v: Verdict): PublicVerdict {
  return {
    score: v.score,
    grade: v.grade,
    risk: v.risk,
    issues: Array.isArray(v.issues) ? v.issues.filter((issue): issue is string => typeof issue === 'string') : [],
    summary: v.summary,
    verdictId: v.verdictId,
    timestamp: v.timestamp,
    ...(typeof v.signature === 'string' && v.signature.length > 0 ? { signature: v.signature } : {}),
  };
}
