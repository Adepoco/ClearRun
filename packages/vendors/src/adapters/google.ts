// ============================================================================
// GOOGLE ADAPTER
// Supports Google Generative AI (Gemini Pro, Flash, Ultra)
// ============================================================================

import { BaseAdapter, AdapterConfig, ExecutionOptions, AdapterError } from './base';
import { UnifiedRequest, UnifiedResponse } from '../registry/types';
import { normalizeRequestForVendor, normalizeVendorResponse } from '../registry/normalizer';

export class GoogleAdapter extends BaseAdapter {
  vendorId = 'google';
  
  private apiKey: string = '';
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';
  
  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    this.apiKey = config.apiKey || process.env.GOOGLE_API_KEY || '';
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
      throw new AdapterError('Google adapter not configured', undefined, undefined, this.vendorId);
    }
    
    const startTime = Date.now();
    
    // Normalize request for Google format
    const vendorRequest = normalizeRequestForVendor(request, options.model);
    
    // Make request
    const modelId = options.model.vendorModelId;
    const response = await this.makeRequest(
      `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`,
      vendorRequest,
      {
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
      throw new AdapterError('Google adapter not configured', undefined, undefined, this.vendorId);
    }
    
    const vendorRequest = normalizeRequestForVendor(request, options.model);
    const modelId = options.model.vendorModelId;
    
    const response = await this.makeRequest(
      `${this.baseUrl}/models/${modelId}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      vendorRequest,
      {}
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
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { content: text };
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
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      
      if (!response.ok) return [];
      
      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      return (data.models || [])
        .map((m: any) => m.name?.replace('models/', ''))
        .filter((id: string) => id?.startsWith('gemini'));
    } catch {
      return [];
    }
  }
}
