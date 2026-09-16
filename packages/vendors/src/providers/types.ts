// SPDX-License-Identifier: MIT
// Local provider types for @clearrun/vendors (OPEN).
// Do not import hosted-app path aliases or closed billing helpers.

export type ProviderType = 'openai' | 'anthropic' | 'google';

export type ExecutionMode = 'single' | 'parallel' | 'consensus';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ProviderMetadata {
  provider: ProviderType;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  finishReason: string;
}

export function generateProviderId(): string {
  return `vnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
