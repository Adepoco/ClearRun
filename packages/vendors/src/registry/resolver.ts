// ============================================================================
// MODEL RESOLVER
// Resolves model requests to canonical definitions with policy enforcement
// Handles unknown, deprecated, and unavailable models
// ============================================================================

import {
  ModelDefinition,
  ModelResolution,
  RegistryWarning,
  EnterpriseModelPolicy,
} from './types';
import { getModel, findClosestModel, getSuccessorModel, getModelsForLane } from './models';
import { getVendor, vendorSupportsRegion } from './vendors';

export interface ResolveOptions {
  requestedModel: string;
  lane: 'self_serve' | 'business' | 'enterprise';
  region?: string;
  policy?: EnterpriseModelPolicy;
}

/**
 * Resolve a model request to a canonical model definition
 * Enforces lane availability, policies, and handles deprecation
 */
export function resolveModel(options: ResolveOptions): ModelResolution {
  const { requestedModel, lane, region, policy } = options;
  const warnings: RegistryWarning[] = [];
  
  // Step 1: Try to find the model
  let model = getModel(requestedModel);
  let substituted = false;
  
  if (!model) {
    // Model not found - try to find closest match
    warnings.push({
      code: 'MODEL_UNAVAILABLE_IN_LANE',
      message: `Model "${requestedModel}" not found in registry`,
      severity: 'warning',
      details: { requestedModel },
    });
    
    // Try partial matching
    const partialMatch = tryPartialMatch(requestedModel);
    if (partialMatch) {
      model = partialMatch;
      substituted = true;
      warnings.push({
        code: 'MODEL_SUBSTITUTED',
        message: `Resolved "${requestedModel}" to "${model.displayName}"`,
        severity: 'info',
        details: { originalRequest: requestedModel, resolvedTo: model.modelId },
      });
    }
  }
  
  if (!model) {
    return {
      success: false,
      originalRequest: requestedModel,
      substituted: false,
      warnings,
      blockedReason: `Model "${requestedModel}" not found and no suitable substitute available`,
    };
  }
  
  // Step 2: Check deprecation
  if (model.status === 'deprecated') {
    warnings.push({
      code: 'MODEL_DEPRECATED',
      message: `Model "${model.displayName}" is deprecated`,
      severity: 'warning',
      details: {
        deprecationDate: model.deprecationDate,
        successor: model.successorModelId,
      },
    });
    
    // Try to use successor
    const successor = getSuccessorModel(model.modelId);
    if (successor && successor.status === 'active') {
      const previousModel = model;
      model = successor;
      substituted = true;
      warnings.push({
        code: 'MODEL_SUBSTITUTED',
        message: `Auto-upgraded to successor "${model.displayName}"`,
        severity: 'info',
        details: { from: previousModel.modelId, to: model.modelId },
      });
    }
  }
  
  if (model.status === 'discontinued') {
    const successor = getSuccessorModel(model.modelId) || findClosestModel(model.modelId);
    if (successor) {
      model = successor;
      substituted = true;
      warnings.push({
        code: 'MODEL_SUBSTITUTED',
        message: `Model discontinued, substituted with "${model.displayName}"`,
        severity: 'warning',
      });
    } else {
      return {
        success: false,
        originalRequest: requestedModel,
        substituted: false,
        warnings,
        blockedReason: `Model "${requestedModel}" has been discontinued with no available substitute`,
      };
    }
  }
  
  // Step 3: Check lane availability
  const isAvailableInLane = model.laneAvailability.includes(lane) || 
                           model.laneAvailability.includes('all');
  
  if (!isAvailableInLane) {
    warnings.push({
      code: 'MODEL_UNAVAILABLE_IN_LANE',
      message: `Model "${model.displayName}" not available in ${lane} lane`,
      severity: 'error',
      details: { availableIn: model.laneAvailability },
    });
    
    // Try to find alternative in same family for this lane
    const laneModels = getModelsForLane(lane);
    const familyAlternative = laneModels.find(m => 
      m.family === model!.family && m.status === 'active'
    );
    
    if (familyAlternative) {
      model = familyAlternative;
      substituted = true;
      warnings.push({
        code: 'MODEL_SUBSTITUTED',
        message: `Substituted with "${model.displayName}" (available in ${lane})`,
        severity: 'warning',
      });
    } else {
      return {
        success: false,
        originalRequest: requestedModel,
        substituted: false,
        warnings,
        blockedReason: `Model "${requestedModel}" not available in ${lane} lane`,
      };
    }
  }
  
  // Step 4: Check vendor availability
  const vendor = getVendor(model.vendorId);
  if (!vendor || vendor.status !== 'active') {
    warnings.push({
      code: 'VENDOR_UNAVAILABLE',
      message: `Vendor "${model.vendorId}" is not available`,
      severity: 'error',
    });
    
    return {
      success: false,
      originalRequest: requestedModel,
      substituted: false,
      warnings,
      blockedReason: `Vendor for model "${requestedModel}" is unavailable`,
    };
  }
  
  // Step 5: Check region restrictions
  if (region && vendor.supportsRegions) {
    if (!vendorSupportsRegion(model.vendorId, region)) {
      warnings.push({
        code: 'REGION_RESTRICTED',
        message: `Model not available in region "${region}"`,
        severity: 'warning',
        details: { availableRegions: vendor.regions },
      });
    }
  }
  
  // Step 6: Apply enterprise policy
  if (policy) {
    const policyResult = applyEnterprisePolicy(model, policy, warnings);
    if (!policyResult.allowed) {
      // Try fallback model from policy
      if (policy.fallbackModel) {
        const fallback = getModel(policy.fallbackModel);
        if (fallback) {
          model = fallback;
          substituted = true;
          warnings.push({
            code: 'MODEL_SUBSTITUTED',
            message: `Policy blocked model, using fallback "${model.displayName}"`,
            severity: 'warning',
          });
        } else {
          return {
            success: false,
            originalRequest: requestedModel,
            substituted: false,
            warnings,
            blockedReason: policyResult.reason,
          };
        }
      } else {
        return {
          success: false,
          originalRequest: requestedModel,
          substituted: false,
          warnings,
          blockedReason: policyResult.reason,
        };
      }
    }
  }
  
  // Success
  return {
    success: true,
    resolvedModel: model,
    resolvedVendor: vendor,
    originalRequest: requestedModel,
    substituted,
    warnings,
  };
}

/**
 * Try partial matching for model names
 */
function tryPartialMatch(query: string): ModelDefinition | undefined {
  const normalized = query.toLowerCase().trim();
  
  // Common patterns to try
  const patterns = [
    // "gpt4o" -> "gpt-4o"
    normalized.replace(/(\d)([a-z])/g, '$1-$2'),
    // "claude3.5sonnet" -> "claude-3.5-sonnet"
    normalized.replace(/(\d+\.?\d*)([a-z])/g, '$1-$2').replace(/([a-z])(\d)/g, '$1-$2'),
    // Add vendor prefix if missing
    `openai/${normalized}`,
    `anthropic/${normalized}`,
    `google/${normalized}`,
    // Try "latest" suffix
    `${normalized}-latest`,
  ];
  
  for (const pattern of patterns) {
    const model = getModel(pattern);
    if (model) return model;
  }
  
  return undefined;
}

/**
 * Apply enterprise policy restrictions
 */
function applyEnterprisePolicy(
  model: ModelDefinition,
  policy: EnterpriseModelPolicy,
  warnings: RegistryWarning[]
): { allowed: boolean; reason?: string } {
  // Check vendor blocklist
  if (policy.blockedVendors?.includes(model.vendorId)) {
    return { 
      allowed: false, 
      reason: `Vendor "${model.vendorId}" blocked by enterprise policy` 
    };
  }
  
  // Check vendor allowlist
  if (policy.allowedVendors && policy.allowedVendors.length > 0) {
    if (!policy.allowedVendors.includes(model.vendorId)) {
      return { 
        allowed: false, 
        reason: `Vendor "${model.vendorId}" not in allowed list` 
      };
    }
  }
  
  // Check model blocklist
  if (policy.blockedModels?.includes(model.modelId)) {
    return { 
      allowed: false, 
      reason: `Model "${model.modelId}" blocked by enterprise policy` 
    };
  }
  
  // Check model allowlist
  if (policy.allowedModels && policy.allowedModels.length > 0) {
    if (!policy.allowedModels.includes(model.modelId)) {
      return { 
        allowed: false, 
        reason: `Model "${model.modelId}" not in allowed list` 
      };
    }
  }
  
  // Check family blocklist
  if (policy.blockedFamilies?.includes(model.family)) {
    return { 
      allowed: false, 
      reason: `Model family "${model.family}" blocked by enterprise policy` 
    };
  }
  
  // Check family allowlist
  if (policy.allowedFamilies && policy.allowedFamilies.length > 0) {
    if (!policy.allowedFamilies.includes(model.family)) {
      return { 
        allowed: false, 
        reason: `Model family "${model.family}" not in allowed list` 
      };
    }
  }
  
  // Check capability requirements
  if (policy.requireToolSupport && !model.capabilities.toolUse) {
    return { 
      allowed: false, 
      reason: `Model does not support required tool use capability` 
    };
  }
  
  if (policy.requireReasoning && !model.capabilities.reasoning) {
    return { 
      allowed: false, 
      reason: `Model does not support required reasoning capability` 
    };
  }
  
  // Check context window limit
  if (policy.maxContextWindow && model.contextWindow > policy.maxContextWindow) {
    warnings.push({
      code: 'FEATURE_UNSUPPORTED',
      message: `Model context window exceeds policy limit`,
      severity: 'warning',
      details: { 
        modelContext: model.contextWindow, 
        policyLimit: policy.maxContextWindow 
      },
    });
  }
  
  // Check cost tier
  if (policy.maxCostTier) {
    const tierOrder = { low: 1, medium: 2, high: 3, premium: 4 };
    if (tierOrder[model.costTier] > tierOrder[policy.maxCostTier]) {
      return { 
        allowed: false, 
        reason: `Model cost tier "${model.costTier}" exceeds policy maximum "${policy.maxCostTier}"` 
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Get resolution warnings formatted for different surfaces
 */
export function formatWarningsForSurface(
  warnings: RegistryWarning[],
  surface: 'chat' | 'report' | 'audit'
): RegistryWarning[] {
  switch (surface) {
    case 'chat':
      // Only show critical warnings
      return warnings.filter(w => w.severity === 'error' || w.code === 'MODEL_SUBSTITUTED');
    
    case 'report':
      // Show aggregated warnings
      return warnings.filter(w => w.severity !== 'info');
    
    case 'audit':
      // Show all warnings
      return warnings;
    
    default:
      return warnings;
  }
}
