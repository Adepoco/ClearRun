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
  risk?: 'low' | 'moderate' | 'elevated' | 'high';
  issues?: string[];
  summary: string;
  verdictId: string;
  timestamp?: string;
  signature?: string;
  schemaVersion?: string;
  scoringVersion?: string;
  failureCategories?: string[];
  confidenceInterval?: { min: number; max: number } | null;
  componentSignals?: Array<{ name: string; level: number; note?: string }>;
  signalsDigest?: string;
  signalsSalt?: string;
  inputHash?: string;
  outputHash?: string;
  verdictHash?: string;
}

export interface VerifyOptions {
  baseUrl?: string;
  apiKey?: string;
  fetch?: FetchLike;
  /**
   * Environment for CLEARRUN_API_KEY and the user config path.
   * Defaults to process.env. An explicit apiKey still wins.
   */
  env?: Record<string, string | undefined>;
}

export interface LookupResult {
  verified: boolean;
  verdict?: PublicVerdict;
}

export const NO_VERDICT_MESSAGE = 'ClearRun did not return a verdict.';
export const NO_VERIFY_MESSAGE = 'ClearRun did not return a verification result.';

export async function scoreText(text: string, options?: VerifyOptions): Promise<PublicVerdict> {
  // Programmatic calls resolve the key here: explicit option, then
  // CLEARRUN_API_KEY, then the user config file. `clearrun score` still
  // resolves its own key, including clearrun.config.json, and passes it
  // as apiKey, which wins over the environment and the user config file.
  const client = createKernelClient({
    hosted: {
      apiKey: options?.apiKey,
      baseUrl: options?.baseUrl,
    },
    deps: options?.fetch ? { fetch: options.fetch } : undefined,
    env: options?.env ?? process.env,
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

function copyString(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toPublicVerdict(v: Verdict): PublicVerdict {
  const issues = Array.isArray(v.issues)
    ? v.issues.filter((issue): issue is string => typeof issue === 'string')
    : undefined;
  return {
    score: v.score,
    grade: v.grade,
    summary: v.summary,
    verdictId: v.verdictId,
    ...(typeof v.risk === 'string' ? { risk: v.risk } : {}),
    ...(issues !== undefined ? { issues } : {}),
    ...(copyString(v.timestamp) !== undefined ? { timestamp: v.timestamp } : {}),
    ...(copyString(v.signature) !== undefined ? { signature: copyString(v.signature) } : {}),
    ...(copyString(v.schemaVersion) !== undefined ? { schemaVersion: v.schemaVersion } : {}),
    ...(copyString(v.scoringVersion) !== undefined ? { scoringVersion: v.scoringVersion } : {}),
    ...(Array.isArray(v.failureCategories) ? { failureCategories: v.failureCategories } : {}),
    ...(v.confidenceInterval !== undefined ? { confidenceInterval: v.confidenceInterval } : {}),
    ...(Array.isArray(v.componentSignals) ? { componentSignals: v.componentSignals } : {}),
    ...(copyString(v.signalsDigest) !== undefined ? { signalsDigest: v.signalsDigest } : {}),
    ...(copyString(v.signalsSalt) !== undefined ? { signalsSalt: v.signalsSalt } : {}),
    ...(copyString(v.inputHash) !== undefined ? { inputHash: v.inputHash } : {}),
    ...(copyString(v.outputHash) !== undefined ? { outputHash: v.outputHash } : {}),
    ...(copyString(v.verdictHash) !== undefined ? { verdictHash: v.verdictHash } : {}),
  };
}
