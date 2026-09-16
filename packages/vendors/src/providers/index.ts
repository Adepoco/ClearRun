// ============================================================================
// PROVIDER ROUTER
// Routes requests to appropriate AI provider
// ============================================================================

import { ProviderType, Message, ExecutionMode } from './types';
import { BaseProvider, ProviderRequest, ProviderResponse } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { generateProviderId } from './types';

// Provider instances (singleton pattern)
const providers: Map<ProviderType, BaseProvider> = new Map();

function getProvider(type: ProviderType): BaseProvider {
  if (!providers.has(type)) {
    switch (type) {
      case 'openai':
        providers.set(type, new OpenAIProvider());
        break;
      case 'anthropic':
        providers.set(type, new AnthropicProvider());
        break;
      case 'google':
        providers.set(type, new GoogleProvider());
        break;
      default:
        throw new Error(`Unsupported provider: ${type}`);
    }
  }
  return providers.get(type)!;
}

export interface ExecuteOptions {
  userId: string;
  prompt: string;
  provider: ProviderType;
  model: string;
  context?: Message[];
  executionMode?: ExecutionMode;
  temperature?: number;
  maxTokens?: number;
}

export interface ExecuteResult {
  executionId: string;
  response: ProviderResponse;
}

/**
 * Execute a single model request
 */
export async function executeModel(options: ExecuteOptions): Promise<ExecuteResult> {
  const provider = getProvider(options.provider);
  
  const request: ProviderRequest = {
    prompt: options.prompt,
    model: options.model,
    context: options.context,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };
  
  const response = await provider.execute(request);

  return {
    executionId: generateProviderId(),
    response,
  };
}

/**
 * Execute same prompt across multiple models (parallel mode)
 */
export async function executeParallel(
  options: Omit<ExecuteOptions, 'provider' | 'model'> & { providers: Array<{ provider: ProviderType; model: string }> }
): Promise<ExecuteResult[]> {
  const promises = options.providers.map(async (p) => {
    return executeModel({
      ...options,
      provider: p.provider,
      model: p.model,
    });
  });
  
  return Promise.all(promises);
}

/**
 * Execute consensus mode (aggregate responses)
 */
export async function executeConsensus(
  options: Omit<ExecuteOptions, 'provider' | 'model'> & { providers: Array<{ provider: ProviderType; model: string }> }
): Promise<{ results: ExecuteResult[]; disagreementScore: number }> {
  const results = await executeParallel(options);
  
  // Calculate disagreement based on response similarity
  // Simple implementation: compare response lengths and key terms
  const responses = results.map(r => r.response.content);
  const disagreementScore = calculateDisagreement(responses);
  
  return { results, disagreementScore };
}

/**
 * Calculate disagreement score between multiple responses
 * Returns 0-1 where 0 = complete agreement, 1 = complete disagreement
 */
function calculateDisagreement(responses: string[]): number {
  if (responses.length < 2) return 0;
  
  // Simple heuristic: compare word overlap
  const wordSets = responses.map(r => new Set(r.toLowerCase().split(/\s+/)));
  
  let totalOverlap = 0;
  let comparisons = 0;
  
  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const intersection = new Set(Array.from(wordSets[i]).filter(x => wordSets[j].has(x)));
      const union = new Set([...Array.from(wordSets[i]), ...Array.from(wordSets[j])]);
      const jaccardSimilarity = intersection.size / union.size;
      totalOverlap += jaccardSimilarity;
      comparisons++;
    }
  }
  
  const avgSimilarity = totalOverlap / comparisons;
  return 1 - avgSimilarity; // Convert similarity to disagreement
}

export { BaseProvider } from './base';
export type { ProviderRequest, ProviderResponse, ProviderError } from './base';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { GoogleProvider } from './google';
