// ============================================================================
// BASE PROVIDER INTERFACE
// Provider-agnostic abstraction for AI model execution
// ============================================================================

import { ProviderType, Message, ProviderMetadata } from './types';

export interface ProviderRequest {
  prompt: string;
  model: string;
  context?: Message[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ProviderResponse {
  content: string;
  metadata: ProviderMetadata;
}

export abstract class BaseProvider {
  abstract readonly providerType: ProviderType;
  
  abstract execute(request: ProviderRequest): Promise<ProviderResponse>;
  
  abstract validateConfig(): boolean;
  
  protected async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const start = Date.now();
    const result = await fn();
    const latencyMs = Date.now() - start;
    return { result, latencyMs };
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderType,
    public readonly code: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
