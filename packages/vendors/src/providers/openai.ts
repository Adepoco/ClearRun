// ============================================================================
// OPENAI PROVIDER
// Integration with OpenAI API (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)
// ============================================================================

import OpenAI from 'openai';
import { BaseProvider, ProviderRequest, ProviderResponse, ProviderError } from './base';
import { ProviderType } from './types';

export class OpenAIProvider extends BaseProvider {
  readonly providerType: ProviderType = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    super();
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  validateConfig(): boolean {
    return !!process.env.OPENAI_API_KEY || !!this.client.apiKey;
  }

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      
      // Add context messages
      if (request.context) {
        for (const msg of request.context) {
          messages.push({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          });
        }
      }
      
      // Add the current prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const { result, latencyMs } = await this.measureLatency(async () => {
        return this.client.chat.completions.create({
          model: request.model || 'gpt-4o',
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
        });
      });

      const choice = result.choices[0];
      const content = choice.message.content || '';
      
      return {
        content,
        metadata: {
          provider: 'openai',
          model: result.model,
          tokensInput: result.usage?.prompt_tokens || 0,
          tokensOutput: result.usage?.completion_tokens || 0,
          latencyMs,
          finishReason: choice.finish_reason || 'unknown',
        },
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new ProviderError(
          'openai',
          error.code || 'API_ERROR',
          error.message,
          error
        );
      }
      throw new ProviderError(
        'openai',
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }
}
