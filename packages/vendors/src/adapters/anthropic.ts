// ============================================================================
// ANTHROPIC ADAPTER
// Supports Anthropic API (Claude Opus, Sonnet, Haiku - all versions)
// ============================================================================

import { BaseAdapter, AdapterConfig, ExecutionOptions, AdapterError } from './base';
import { UnifiedRequest, UnifiedResponse } from '../registry/types';
import { normalizeRequestForVendor, normalizeVendorResponse } from '../registry/normalizer';

export class AnthropicAdapter extends BaseAdapter {
  vendorId = 'anthropic';
  
  private apiKey: string = '';
  private baseUrl: string = 'https://api.anthropic.com';
  private apiVersion: string = '2023-06-01';
  
  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
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
      throw new AdapterError('Anthropic adapter not configured', undefined, undefined, this.vendorId);
    }
    
    const startTime = Date.now();
    
    // Normalize request for Anthropic format
    const vendorRequest = normalizeRequestForVendor(request, options.model);
    
    // Make request
    const response = await this.makeRequest(
      `${this.baseUrl}/v1/messages`,
      vendorRequest,
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
          'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
        },
        timeout: options.timeout || 120000, // Anthropic can be slow
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
      throw new AdapterError('Anthropic adapter not configured', undefined, undefined, this.vendorId);
    }
    
    const vendorRequest = {
      ...normalizeRequestForVendor(request, options.model),
      stream: true,
    };
    
    const response = await this.makeRequest(
      `${this.baseUrl}/v1/messages`,
      vendorRequest,
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
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
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta') {
              const delta = parsed.delta;
              if (delta?.type === 'text_delta' && delta?.text) {
                yield { content: delta.text };
              }
            }
            
            if (parsed.type === 'message_stop') {
              return;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
  
  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint
    // Return known models
    return [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }
}
