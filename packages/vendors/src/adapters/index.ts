// ============================================================================
// ADAPTER REGISTRY
// Central management for all vendor adapters
// ============================================================================

import { VendorAdapter, AdapterConfig } from './base';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';

export * from './base';
export { OpenAIAdapter } from './openai';
export { AnthropicAdapter } from './anthropic';
export { GoogleAdapter } from './google';

/**
 * Adapter registry - singleton map of initialized adapters
 */
class AdapterRegistry {
  private adapters: Map<string, VendorAdapter> = new Map();
  private initialized = false;
  
  /**
   * Initialize all adapters with config
   */
  async initialize(configs?: Record<string, AdapterConfig>): Promise<void> {
    if (this.initialized) return;

    const openai = new OpenAIAdapter();
    await openai.initialize(configs?.openai ?? { apiKey: process.env.OPENAI_API_KEY });
    this.adapters.set('openai', openai);

    const anthropic = new AnthropicAdapter();
    await anthropic.initialize(configs?.anthropic ?? { apiKey: process.env.ANTHROPIC_API_KEY });
    this.adapters.set('anthropic', anthropic);

    const google = new GoogleAdapter();
    await google.initialize(configs?.google ?? { apiKey: process.env.GOOGLE_API_KEY });
    this.adapters.set('google', google);

    const anyConfigured = [openai, anthropic, google].some((a) => a.isConfigured());
    if (!anyConfigured) {
      throw new Error(
        'At least one vendor adapter must be configured (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY).'
      );
    }

    this.initialized = true;
  }
  
  /**
   * Get adapter for a vendor
   */
  getAdapter(vendorId: string): VendorAdapter | undefined {
    return this.adapters.get(vendorId);
  }
  
  /**
   * Get all configured adapters
   */
  getConfiguredAdapters(): VendorAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.isConfigured());
  }
  
  /**
   * Get all adapters
   */
  getAllAdapters(): VendorAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Check if a vendor adapter is configured
   */
  isVendorConfigured(vendorId: string): boolean {
    const adapter = this.adapters.get(vendorId);
    return adapter?.isConfigured() ?? false;
  }
  
  /**
   * Get status of all adapters
   */
  getStatus(): Record<string, { configured: boolean; vendorId: string }> {
    const status: Record<string, { configured: boolean; vendorId: string }> = {};
    
    for (const [vendorId, adapter] of Array.from(this.adapters.entries())) {
      status[vendorId] = {
        vendorId,
        configured: adapter.isConfigured(),
      };
    }
    
    return status;
  }
  
  /**
   * Reset registry (for testing)
   */
  reset(): void {
    this.adapters.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const adapterRegistry = new AdapterRegistry();

/**
 * Initialize adapters (call at app startup)
 */
export async function initializeAdapters(configs?: Record<string, AdapterConfig>): Promise<void> {
  await adapterRegistry.initialize(configs);
}

/**
 * Get adapter for a vendor
 */
export function getAdapter(vendorId: string): VendorAdapter | undefined {
  return adapterRegistry.getAdapter(vendorId);
}

/**
 * Execute request using appropriate adapter
 */
export async function executeWithAdapter(
  vendorId: string,
  request: import('../registry/types').UnifiedRequest,
  model: import('../registry/types').ModelDefinition,
  vendor: import('../registry/types').VendorDefinition
): Promise<import('../registry/types').UnifiedResponse> {
  const adapter = adapterRegistry.getAdapter(vendorId);

  if (!adapter) {
    throw new Error(`Adapter not initialized for vendor: ${vendorId}. Call initializeAdapters() first.`);
  }

  if (!adapter.isConfigured()) {
    throw new Error(`${vendorId} adapter is not configured (missing API key).`);
  }

  return adapter.execute(request, { model, vendor });
}
