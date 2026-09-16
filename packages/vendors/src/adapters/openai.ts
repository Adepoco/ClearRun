// ============================================================================
// OPENAI ADAPTER
// Supports OpenAI API (GPT-4.x, o-series, GPT-3.5)
// ============================================================================

import { BaseAdapter, AdapterConfig, ExecutionOptions, AdapterError } from './base';
import { UnifiedRequest, UnifiedResponse } from '../registry/types';
import { normalizeRequestForVendor, normalizeVendorResponse } from '../registry/normalizer';

export class OpenAIAdapter extends BaseAdapter {
  vendorId = 'openai';
  
  private apiKey: string = '';
  private baseUrl: string = 'https://api.openai.com/v1';
  
  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.apiBaseUrl || this.baseUrl;
  }
  
  isConfigured(): boolean {
    return !!this.apiKey;
  }
  
  async execute(
    request: UnifiedRequest,
    options: ExecutionOptions
  ): Promise<UnifiedResponse> {
    if (!this.isConfigured()) {
      throw new AdapterError('OpenAI adapter not configured', undefined, undefined, this.vendorId);
    }
    
    const startTime = Date.now();
    
    // Normalize request for OpenAI format
    const vendorRequest = normalizeRequestForVendor(request, options.model);
    
    // Make request
    const response = await this.makeRequest(
      `${this.baseUrl}/chat/completions`,
      vendorRequest,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: options.timeout || 60000,
        signal: options.signal,
      }
    );
    
    const vendorResponse = (await response.json()) as Record<string, unknown>;
    const latencyMs = Date.now() - startTime;
    
    // Normalize response to unified format
    return normalizeVendorResponse(
      vendorResponse,
      options.model,
      request.messages[request.messages.length - 1]?.content as string || '',
      latencyMs
    );
  }
  
  async *stream(
    request: UnifiedRequest,
    options: ExecutionOptions
  ): AsyncGenerator<Partial<UnifiedResponse>> {
    if (!this.isConfigured()) {
      throw new AdapterError('OpenAI adapter not configured', undefined, undefined, this.vendorId);
    }
    
    const vendorRequest = {
      ...normalizeRequestForVendor(request, options.model),
      stream: true,
    };
    
    const response = await this.makeRequest(
      `${this.baseUrl}/chat/completions`,
      vendorRequest,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );
    
    const reader = response.body?.getReader();
    if (!reader) throw new AdapterError('No response body', undefined, undefined, this.vendorId);
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { content: delta.content };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
  
  async listModels(): Promise<string[]> {
    if (!this.isConfigured()) return [];
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      if (!response.ok) return [];
      
      const data = (await response.json()) as { data?: Array<{ id?: string }> };
      return (data.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3'));
    } catch {
      return [];
    }
  }
}
