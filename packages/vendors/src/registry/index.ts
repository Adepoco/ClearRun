// ============================================================================
// MODEL VENDOR REGISTRY - PUBLIC API
// Single source of truth for all model/vendor information
// ============================================================================

// Export types
export * from './types';

// Export vendor registry
export {
  VENDOR_REGISTRY,
  getVendor,
  getAllVendors,
  getVendorsByTier,
  getPublicVendors,
  vendorSupportsRegion,
  getGatewaysForVendor,
} from './vendors';

// Export model catalog
export {
  MODEL_CATALOG,
  getModel,
  getAllModels,
  getModelsByVendor,
  getModelsByFamily,
  getModelsForLane,
  getActiveModels,
  getModelsByCapability,
  getSuccessorModel,
  findClosestModel,
} from './models';

// Export resolver
export {
  resolveModel,
  formatWarningsForSurface,
  type ResolveOptions,
} from './resolver';

// Export normalizer
export {
  normalizeRequestForVendor,
  normalizeVendorResponse,
} from './normalizer';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { ModelDefinition, VendorDefinition, EnterpriseModelPolicy } from './types';
import { getModel, getAllModels, getModelsForLane } from './models';
import { getVendor, getAllVendors } from './vendors';
import { resolveModel } from './resolver';

/**
 * Get models grouped by vendor for UI display
 */
export function getModelsGroupedByVendor(
  lane: 'self_serve' | 'business' | 'enterprise'
): Record<string, { vendor: VendorDefinition; models: ModelDefinition[] }> {
  const result: Record<string, { vendor: VendorDefinition; models: ModelDefinition[] }> = {};
  
  const availableModels = getModelsForLane(lane)
    .filter(m => m.status === 'active' || m.status === 'beta');
  
  for (const model of availableModels) {
    const vendor = getVendor(model.vendorId);
    if (!vendor) continue;
    
    // Skip enterprise-only vendors for non-enterprise lanes
    if (vendor.enterpriseOnly && lane !== 'enterprise') continue;
    
    if (!result[model.vendorId]) {
      result[model.vendorId] = { vendor, models: [] };
    }
    result[model.vendorId].models.push(model);
  }
  
  return result;
}

/**
 * Get a flat list of models for UI dropdown
 */
export function getModelOptionsForUI(
  lane: 'self_serve' | 'business' | 'enterprise'
): Array<{
  id: string;
  displayName: string;
  vendorId: string;
  vendorName: string;
  family: string;
  costTier: string;
  hasReasoning: boolean;
  hasVision: boolean;
}> {
  const grouped = getModelsGroupedByVendor(lane);
  const options: Array<{
    id: string;
    displayName: string;
    vendorId: string;
    vendorName: string;
    family: string;
    costTier: string;
    hasReasoning: boolean;
    hasVision: boolean;
  }> = [];
  
  for (const [vendorId, { vendor, models }] of Object.entries(grouped)) {
    for (const model of models) {
      options.push({
        id: model.modelId,
        displayName: model.displayName,
        vendorId: model.vendorId,
        vendorName: vendor.displayName,
        family: model.family,
        costTier: model.costTier,
        hasReasoning: model.capabilities.reasoning,
        hasVision: model.capabilities.vision,
      });
    }
  }
  
  // Sort by vendor, then by cost tier (premium first)
  const tierOrder = { premium: 0, high: 1, medium: 2, low: 3 };
  options.sort((a, b) => {
    if (a.vendorName !== b.vendorName) {
      return a.vendorName.localeCompare(b.vendorName);
    }
    return tierOrder[a.costTier as keyof typeof tierOrder] - tierOrder[b.costTier as keyof typeof tierOrder];
  });
  
  return options;
}

/**
 * Validate a model request and return resolution result
 */
export function validateModelRequest(
  requestedModel: string,
  lane: 'self_serve' | 'business' | 'enterprise',
  region?: string,
  policy?: EnterpriseModelPolicy
) {
  return resolveModel({
    requestedModel,
    lane,
    region,
    policy,
  });
}

/**
 * Check if a model ID is valid (exists in catalog)
 */
export function isValidModel(modelIdOrAlias: string): boolean {
  return getModel(modelIdOrAlias) !== undefined;
}

/**
 * Get default model for a lane
 */
export function getDefaultModel(lane: 'self_serve' | 'business' | 'enterprise'): ModelDefinition {
  // Default preferences by lane
  const preferences: Record<string, string[]> = {
    self_serve: ['openai/gpt-5.4-mini', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 'google/gemini-1.5-flash'],
    business: ['openai/gpt-5.4', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-1.5-pro'],
    enterprise: ['anthropic/claude-opus-4', 'openai/gpt-5.4', 'openai/gpt-4o'],
  };
  
  const prefs = preferences[lane] || preferences.self_serve;
  
  for (const modelId of prefs) {
    const model = getModel(modelId);
    if (model && model.status === 'active') {
      const available = model.laneAvailability.includes(lane) || model.laneAvailability.includes('all');
      if (available) return model;
    }
  }
  
  const available = getModelsForLane(lane).filter(m => m.status === 'active');
  if (available.length === 0) {
    throw new Error(`No active model is registered for lane: ${lane}`);
  }
  return available[0];
}

/**
 * Get vendor display info
 */
export function getVendorDisplayInfo(vendorId: string): {
  name: string;
  icon: string;
  tier: string;
  isEnterprise: boolean;
} | undefined {
  const vendor = getVendor(vendorId);
  if (!vendor) return undefined;
  
  const icons: Record<string, string> = {
    openai: '🟢',
    anthropic: '🟤',
    google: '🔵',
  };
  
  return {
    name: vendor.displayName,
    icon: icons[vendorId] || '⚪',
    tier: vendor.tier === 'tier1_direct' ? 'Direct API' : 'Enterprise Gateway',
    isEnterprise: vendor.enterpriseOnly,
  };
}
