// ============================================================================
// GOOGLE PROVIDER
// Integration with Google Generative AI API (Gemini 1.5 Pro, Gemini 1.5 Flash)
// ============================================================================

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseProvider, ProviderRequest, ProviderResponse, ProviderError } from './base';
import { ProviderType } from './types';

export class GoogleProvider extends BaseProvider {
  readonly providerType: ProviderType = 'google';
  private client: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    super();
    this.client = new GoogleGenerativeAI(apiKey || process.env.GOOGLE_API_KEY || '');
  }

  validateConfig(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const model: GenerativeModel = this.client.getGenerativeModel({
        model: request.model || 'gemini-1.5-pro',
      });

      // Build conversation history
      const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      
      if (request.context) {
        for (const msg of request.context) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            history.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            });
          }
        }
      }

      const { result, latencyMs } = await this.measureLatency(async () => {
        const chat = model.startChat({
          history,
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? 4096,
            temperature: request.temperature ?? 0.7,
          },
        });
        
        return chat.sendMessage(request.prompt);
      });

      const response = result.response;
      const content = response.text();
      
      // Estimate tokens (Gemini doesn't always return exact counts)
      const inputTokens = Math.ceil((request.prompt.length + history.reduce((acc, h) => acc + h.parts[0].text.length, 0)) / 4);
      const outputTokens = Math.ceil(content.length / 4);
      
      return {
        content,
        metadata: {
          provider: 'google',
          model: request.model || 'gemini-1.5-pro',
          tokensInput: inputTokens,
          tokensOutput: outputTokens,
          latencyMs,
          finishReason: response.candidates?.[0]?.finishReason || 'STOP',
        },
      };
    } catch (error) {
      throw new ProviderError(
        'google',
        'API_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }
}
