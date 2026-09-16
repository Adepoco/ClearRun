// ============================================================================
// ANTHROPIC PROVIDER
// Integration with Anthropic API (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderRequest, ProviderResponse, ProviderError } from './base';
import { ProviderType } from './types';

export class AnthropicProvider extends BaseProvider {
  readonly providerType: ProviderType = 'anthropic';
  private client: Anthropic;

  constructor(apiKey?: string) {
    super();
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  validateConfig(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const messages: Anthropic.MessageParam[] = [];
      
      // Add context messages
      if (request.context) {
        for (const msg of request.context) {
          if (msg.role !== 'system') {
            messages.push({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            });
          }
        }
      }
      
      // Add the current prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      // Extract system message if present
      const systemMessage = request.context?.find(m => m.role === 'system')?.content;

      const { result, latencyMs } = await this.measureLatency(async () => {
        return this.client.messages.create({
          model: request.model || 'claude-3-5-sonnet-20241022',
          max_tokens: request.maxTokens ?? 4096,
          messages,
          system: systemMessage,
        });
      });

      const content = result.content
        .filter((block) => block.type === 'text')
        .map(block => (block as Anthropic.TextBlock).text)
        .join('\n');
      
      return {
        content,
        metadata: {
          provider: 'anthropic',
          model: result.model,
          tokensInput: result.usage.input_tokens,
          tokensOutput: result.usage.output_tokens,
          latencyMs,
          finishReason: result.stop_reason || 'unknown',
        },
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new ProviderError(
          'anthropic',
          'API_ERROR',
          error.message,
          error
        );
      }
      throw new ProviderError(
        'anthropic',
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }
}
