// ============================================================================
// BASE ADAPTER - UNIFIED VENDOR ADAPTER INTERFACE
// All vendor adapters implement this contract
// ============================================================================

import {
  UnifiedRequest,
  UnifiedResponse,
  ModelDefinition,
  VendorDefinition,
} from '../registry/types';
import { ADAPTER_TIMEOUTS } from '../lib/config';

/**
 * Configuration for adapter initialization
 */
export interface AdapterConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  region?: string;
  projectId?: string;       // For GCP
  deploymentId?: string;    // For Azure
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

/**
 * Adapter execution options
 */
export interface ExecutionOptions {
  model: ModelDefinition;
  vendor: VendorDefinition;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Base adapter interface
 * All vendor adapters must implement this
 */
export interface VendorAdapter {
  vendorId: string;
  
  /**
   * Initialize the adapter with credentials/config
   */
  initialize(config: AdapterConfig): Promise<void>;
  
  /**
   * Check if adapter is properly configured
   */
  isConfigured(): boolean;
  
  /**
   * Execute a unified request
   */
  execute(
    request: UnifiedRequest,
    options: ExecutionOptions
  ): Promise<UnifiedResponse>;
  
  /**
   * Stream a unified request (if supported)
   */
  stream?(
    request: UnifiedRequest,
    options: ExecutionOptions
  ): AsyncGenerator<Partial<UnifiedResponse>>;
  
  /**
   * Test connectivity
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Get available models from vendor (live query)
   */
  listModels?(): Promise<string[]>;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseAdapter implements VendorAdapter {
  abstract vendorId: string;
  
  protected config: AdapterConfig = {};
  protected initialized = false;
  
  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }
  
  isConfigured(): boolean {
    return this.initialized && !!this.config.apiKey;
  }
  
  abstract execute(
    request: UnifiedRequest,
    options: ExecutionOptions
  ): Promise<UnifiedResponse>;
  
  async testConnection(): Promise<boolean> {
    try {
      // Default: try a minimal request
      await this.execute(
        {
          messages: [{ role: 'user', content: 'test' }],
          maxTokens: 1,
        },
        { model: {} as ModelDefinition, vendor: {} as VendorDefinition }
      );
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Helper: Make HTTP request with error handling
   */
  protected async makeRequest(
    url: string,
    body: unknown,
    options: {
      headers?: Record<string, string>;
      timeout?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<Response> {
    const { headers = {}, timeout = ADAPTER_TIMEOUTS.DEFAULT, signal } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...headers,
        },
        body: JSON.stringify(body),
        signal: signal || controller.signal,
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new AdapterError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Custom error class for adapter errors
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string,
    public vendorId?: string
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}
