// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// MockKernelClient — a public, schema-valid implementation of HonestyKernelClient
// that requires NO hosted API and NO closed kernel. It lets the public repo
// build, run, and be tested with CV-ClearRun-core absent (invariant #2). It
// contains NO scoring formula or governance logic — it returns canned,
// contract-valid Verdicts derived only from trivial surface features.

import {
  VERDICT_SCHEMA_VERSION,
  type HonestyKernelClient,
  type EvaluateRequest,
  type EvaluateResponse,
  type ChatRequest,
  type ChatResponse,
  type ScoreRequest,
  type ScoreResponse,
  type VerifyRequest,
  type VerifyResponse,
  type Verdict,
  type VerdictGrade,
  type VerdictRisk,
} from '@clearrun/core-types';

const MOCK_SCORING_VERSION = 'mock-1.0.0';

function mockId(): string {
  return 'mock_' + Math.random().toString(36).slice(2, 12);
}

function grade(score: number): VerdictGrade {
  if (score >= 90) return 'Well supported';
  if (score >= 75) return 'Generally reliable';
  if (score >= 60) return 'Verify before use';
  if (score >= 40) return 'High risk';
  return 'Likely misleading';
}

function risk(score: number): VerdictRisk {
  if (score >= 80) return 'low';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'elevated';
  return 'high';
}

/**
 * Deterministic, formula-free mock score: stable per input length so tests are
 * repeatable. Not an honesty judgement — opt-in local development only.
 */
function mockScore(text: string): number {
  const len = (text ?? '').trim().length;
  return 55 + (len % 40); // 55..94, deterministic
}

function buildMockVerdict(text: string, id = mockId()): Verdict {
  const score = mockScore(text);
  return {
    verdictId: id,
    schemaVersion: VERDICT_SCHEMA_VERSION,
    scoringVersion: MOCK_SCORING_VERSION,
    score,
    grade: grade(score),
    risk: risk(score),
    failureCategories: score < 60 ? ['overconfidence'] : [],
    confidenceInterval: { min: Math.max(0, score - 8), max: Math.min(100, score + 8) },
    summary: 'Mock verdict for local/standalone use; not a real evaluation.',
    componentSignals: [
      { name: 'Evidence support', level: 4, note: 'opt-in mock client' },
      { name: 'Reasoning integrity', level: 5, note: 'opt-in mock client' },
    ],
    issues: [],
    timestamp: new Date().toISOString(),
    signature: null,
    signatureKeyId: null,
    signatureAlg: null,
  };
}

export interface MockClientOptions {
  /** Optional fixed response text for chat(). */
  chatResponse?: string;
}

export class MockKernelClient implements HonestyKernelClient {
  private store = new Map<string, Verdict>();
  private chatResponse: string;

  constructor(opts: MockClientOptions = {}) {
    this.chatResponse = opts.chatResponse ?? 'This is a mock model response.';
  }

  private remember(v: Verdict): Verdict {
    this.store.set(v.verdictId, v);
    return v;
  }

  async evaluate(req: EvaluateRequest): Promise<EvaluateResponse> {
    return { verdict: this.remember(buildMockVerdict(req.responseText)) };
  }

  async score(req: ScoreRequest): Promise<ScoreResponse> {
    return { verdict: this.remember(buildMockVerdict(req.responseText)) };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const responseText = this.chatResponse;
    return { responseText, verdict: this.remember(buildMockVerdict(responseText)) };
  }

  async verify(req: VerifyRequest): Promise<VerifyResponse> {
    const verdict = this.store.get(req.verdictId);
    return verdict ? { verified: Boolean(verdict), verdict } : { verified: false };
  }
}
