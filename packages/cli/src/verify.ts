// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
// CLI helper: score text via the hosted public Verdict. No kernel internals.

export interface PublicVerdict {
  score: number;
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
}

const DEFAULT_BASE_URL = 'https://api.clearrun.net';

export async function verify(
  text: string,
  options?: VerifyOptions
): Promise<PublicVerdict> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`;
  }

  const res = await fetch(`${baseUrl}/api/score`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ responseText: text }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `ClearRun API error: ${res.status}`);
  }

  const data = (await res.json()) as { verdict: PublicVerdict };
  const v = data.verdict;

  return {
    score: v.score,
    grade: v.grade,
    risk: v.risk,
    issues: v.issues,
    summary: v.summary,
    verdictId: v.verdictId,
    timestamp: v.timestamp,
    signature: v.signature,
  };
}
