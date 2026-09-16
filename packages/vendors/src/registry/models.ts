// ============================================================================
// MODEL CATALOG
// Complete registry of all supported models
// Single source of truth - UI and backend pull from here
// UPDATED: March 29, 2026
// ============================================================================

import { ModelDefinition, ModelCapabilities } from './types';

// Default capabilities for convenience
const FULL_CAPABILITIES: ModelCapabilities = {
  chat: true,
  completion: true,
  reasoning: false,
  toolUse: true,
  vision: true,
  codeExecution: false,
  streaming: true,
  jsonMode: true,
  systemInstructions: true,
};

const REASONING_CAPABILITIES: ModelCapabilities = {
  chat: true,
  completion: true,
  reasoning: true,
  toolUse: true,
  vision: true,
  codeExecution: true,
  streaming: true,
  jsonMode: true,
  systemInstructions: true,
};

const CHAT_ONLY: ModelCapabilities = {
  chat: true,
  completion: false,
  reasoning: false,
  toolUse: false,
  vision: false,
  codeExecution: false,
  streaming: true,
  jsonMode: false,
  systemInstructions: true,
};

/**
 * Complete model catalog â€” re-verified 2026-08-27 (INNER)
 * OpenAI: gpt-5.4 / 5.4-mini / 5.4-nano remain current; gpt-4o and gpt-4o-mini
 * stay active as the documented fallback lane defaults.
 */
export const MODEL_CATALOG: Record<string, ModelDefinition> = {
  // =========================================================================
  // OPENAI MODELS (Updated March 29, 2026)
  // =========================================================================
  
  // GPT-5.4 Series (Latest â€” March 2026)
  'openai/gpt-5.4': {
    modelId: 'openai/gpt-5.4',
    vendorId: 'openai',
    vendorModelId: 'gpt-5.4',
    displayName: 'GPT-5.4',
    aliases: ['gpt-5.4', 'gpt5.4', 'gpt-5-4'],
    family: 'gpt-5.4',
    version: '5.4',
    contextWindow: 256000,
    maxOutputTokens: 32768,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'premium',
    releaseDate: '2026-03-01',
    metadata: { multimodal: true, reasoning: true, coding: true, agentic: true },
  },
  
  'openai/gpt-5.4-mini': {
    modelId: 'openai/gpt-5.4-mini',
    vendorId: 'openai',
    vendorModelId: 'gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    aliases: ['gpt-5.4-mini', 'gpt5.4-mini'],
    family: 'gpt-5.4',
    version: '5.4',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: { ...FULL_CAPABILITIES, reasoning: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'medium',
    releaseDate: '2026-03-18',
    metadata: { multimodal: true },
  },
  
  'openai/gpt-5.4-nano': {
    modelId: 'openai/gpt-5.4-nano',
    vendorId: 'openai',
    vendorModelId: 'gpt-5.4-nano',
    displayName: 'GPT-5.4 Nano',
    aliases: ['gpt-5.4-nano', 'gpt5.4-nano'],
    family: 'gpt-5.4',
    version: '5.4',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    releaseDate: '2026-03-18',
    metadata: { lightweight: true },
  },
  
  // GPT-5.3 Series
  'openai/gpt-5.3-instant': {
    modelId: 'openai/gpt-5.3-instant',
    vendorId: 'openai',
    vendorModelId: 'gpt-5.3-instant',
    displayName: 'GPT-5.3 Instant',
    aliases: ['gpt-5.3-instant', 'gpt5.3-instant', 'gpt-5.3'],
    family: 'gpt-5.3',
    version: '5.3',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: { ...FULL_CAPABILITIES, reasoning: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'medium',
    metadata: {},
  },
  
  // GPT-4o Family (Still Active)
  'openai/gpt-4o': {
    modelId: 'openai/gpt-4o',
    vendorId: 'openai',
    vendorModelId: 'gpt-4o',
    displayName: 'GPT-4o',
    aliases: ['gpt-4o', 'gpt4o', 'gpt-4-omni'],
    family: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: { ...FULL_CAPABILITIES, codeExecution: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'medium',
    metadata: { multimodal: true },
  },
  
  'openai/gpt-4o-mini': {
    modelId: 'openai/gpt-4o-mini',
    vendorId: 'openai',
    vendorModelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    aliases: ['gpt-4o-mini', 'gpt4o-mini'],
    family: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    metadata: {},
  },
  
  // GPT-4 Turbo (Legacy but active)
  'openai/gpt-4-turbo': {
    modelId: 'openai/gpt-4-turbo',
    vendorId: 'openai',
    vendorModelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    aliases: ['gpt-4-turbo', 'gpt4-turbo', 'gpt-4-turbo-preview'],
    family: 'gpt-4',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'medium',
    metadata: {},
  },
  
  // O-Series Reasoning Models
  'openai/o3': {
    modelId: 'openai/o3',
    vendorId: 'openai',
    vendorModelId: 'o3',
    displayName: 'O3',
    aliases: ['o3', 'openai-o3'],
    family: 'o3',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['business', 'enterprise'],
    costTier: 'premium',
    metadata: { reasoningModel: true },
  },
  
  'openai/o3-mini': {
    modelId: 'openai/o3-mini',
    vendorId: 'openai',
    vendorModelId: 'o3-mini',
    displayName: 'O3 Mini',
    aliases: ['o3-mini', 'openai-o3-mini'],
    family: 'o3',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'high',
    metadata: { reasoningModel: true },
  },

  'openai/o4-mini': {
    modelId: 'openai/o4-mini',
    vendorId: 'openai',
    vendorModelId: 'o4-mini',
    displayName: 'O4 Mini',
    aliases: ['o4-mini', 'openai-o4-mini', 'o4mini'],
    family: 'o4',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'high',
    metadata: { reasoningModel: true },
  },
  
  'openai/o1': {
    modelId: 'openai/o1',
    vendorId: 'openai',
    vendorModelId: 'o1',
    displayName: 'O1',
    aliases: ['o1', 'openai-o1'],
    family: 'o1',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['business', 'enterprise'],
    costTier: 'premium',
    metadata: { reasoningModel: true },
  },
  
  'openai/o1-mini': {
    modelId: 'openai/o1-mini',
    vendorId: 'openai',
    vendorModelId: 'o1-mini',
    displayName: 'O1 Mini',
    aliases: ['o1-mini', 'openai-o1-mini'],
    family: 'o1',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    capabilities: { ...REASONING_CAPABILITIES, vision: false },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'high',
    metadata: { reasoningModel: true },
  },
  
  // GPT-3.5 (Legacy â€” deprecated)
  'openai/gpt-3.5-turbo': {
    modelId: 'openai/gpt-3.5-turbo',
    vendorId: 'openai',
    vendorModelId: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    aliases: ['gpt-3.5-turbo', 'gpt-35-turbo'],
    family: 'gpt-3.5',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    capabilities: { ...FULL_CAPABILITIES, vision: false },
    status: 'deprecated',
    laneAvailability: ['all'],
    costTier: 'low',
    successorModelId: 'openai/gpt-4o-mini',
    metadata: {},
  },
  
  // =========================================================================
  // ANTHROPIC MODELS (Updated January 7, 2026)
  // =========================================================================
  
  // Claude 4.5 Series (Latest - November 2025)
  'anthropic/claude-4.5-opus': {
    modelId: 'anthropic/claude-4.5-opus',
    vendorId: 'anthropic',
    vendorModelId: 'claude-4-5-opus-20251124',
    displayName: 'Claude 4.5 Opus',
    aliases: ['claude-4.5-opus', 'claude-45-opus', 'claude-opus-4.5', 'claude-opus', 'opus'],
    family: 'claude-4.5',
    version: '4.5',
    contextWindow: 300000,
    maxOutputTokens: 64000,
    capabilities: { ...REASONING_CAPABILITIES, codeExecution: true },
    status: 'active',
    laneAvailability: ['business', 'enterprise'],
    costTier: 'premium',
    releaseDate: '2025-11-24',
    metadata: { extendedThinking: true, agenticWorkflows: true, computerUse: true },
  },
  
  'anthropic/claude-4.5-sonnet': {
    modelId: 'anthropic/claude-4.5-sonnet',
    vendorId: 'anthropic',
    vendorModelId: 'claude-4-5-sonnet-20250929',
    displayName: 'Claude 4.5 Sonnet',
    aliases: ['claude-4.5-sonnet', 'claude-45-sonnet', 'claude-sonnet-4.5', 'claude-sonnet', 'sonnet'],
    family: 'claude-4.5',
    version: '4.5',
    contextWindow: 300000,
    maxOutputTokens: 32000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'high',
    releaseDate: '2025-09-29',
    metadata: { extendedThinking: true, codingOptimized: true, autonomousTasking: true },
  },
  
  'anthropic/claude-4.5-haiku': {
    modelId: 'anthropic/claude-4.5-haiku',
    vendorId: 'anthropic',
    vendorModelId: 'claude-4-5-haiku-20251015',
    displayName: 'Claude 4.5 Haiku',
    aliases: ['claude-4.5-haiku', 'claude-45-haiku', 'claude-haiku-4.5', 'claude-haiku', 'haiku'],
    family: 'claude-4.5',
    version: '4.5',
    contextWindow: 200000,
    maxOutputTokens: 16000,
    capabilities: { ...FULL_CAPABILITIES, reasoning: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    releaseDate: '2025-10-15',
    metadata: { realTimeOptimized: true, lightweight: true },
  },
  
  // Claude 4 Series (Previous generation - deprecated)
  'anthropic/claude-opus-4': {
    modelId: 'anthropic/claude-opus-4',
    vendorId: 'anthropic',
    vendorModelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    aliases: ['claude-opus-4', 'claude-4-opus', 'opus-4'],
    family: 'claude-4',
    version: '4',
    contextWindow: 200000,
    maxOutputTokens: 32000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'deprecated',
    laneAvailability: ['business', 'enterprise'],
    costTier: 'premium',
    successorModelId: 'anthropic/claude-4.5-opus',
    deprecationDate: '2025-11-24',
    metadata: { extendedThinking: true },
  },
  
  'anthropic/claude-sonnet-4': {
    modelId: 'anthropic/claude-sonnet-4',
    vendorId: 'anthropic',
    vendorModelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    aliases: ['claude-sonnet-4', 'claude-4-sonnet', 'sonnet-4'],
    family: 'claude-4',
    version: '4',
    contextWindow: 200000,
    maxOutputTokens: 16000,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'deprecated',
    laneAvailability: ['all'],
    costTier: 'high',
    successorModelId: 'anthropic/claude-4.5-sonnet',
    deprecationDate: '2025-09-29',
    metadata: { extendedThinking: true },
  },
  
  // Claude 3.5 Series
  'anthropic/claude-3.5-sonnet': {
    modelId: 'anthropic/claude-3.5-sonnet',
    vendorId: 'anthropic',
    vendorModelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    aliases: ['claude-3.5-sonnet', 'claude-35-sonnet', 'claude-sonnet-3.5', 'sonnet-3.5'],
    family: 'claude-3.5',
    version: '3.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'medium',
    metadata: {},
  },
  
  'anthropic/claude-3.5-haiku': {
    modelId: 'anthropic/claude-3.5-haiku',
    vendorId: 'anthropic',
    vendorModelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    aliases: ['claude-3.5-haiku', 'claude-35-haiku', 'haiku-3.5'],
    family: 'claude-3.5',
    version: '3.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    metadata: {},
  },
  
  // Claude 3 Series (Legacy)
  'anthropic/claude-3-opus': {
    modelId: 'anthropic/claude-3-opus',
    vendorId: 'anthropic',
    vendorModelId: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    aliases: ['claude-3-opus'],
    family: 'claude-3',
    version: '3',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'deprecated',
    laneAvailability: ['business', 'enterprise'],
    costTier: 'premium',
    successorModelId: 'anthropic/claude-opus-4',
    metadata: {},
  },
  
  'anthropic/claude-3-haiku': {
    modelId: 'anthropic/claude-3-haiku',
    vendorId: 'anthropic',
    vendorModelId: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    aliases: ['claude-3-haiku', 'claude-haiku', 'haiku'],
    family: 'claude-3',
    version: '3',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: { ...FULL_CAPABILITIES, vision: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    metadata: {},
  },
  
  // =========================================================================
  // GOOGLE GEMINI MODELS (Updated January 2026)
  // =========================================================================
  
  // Gemini 3 Series (Latest - November 2025)
  'google/gemini-3-pro': {
    modelId: 'google/gemini-3-pro',
    vendorId: 'google',
    vendorModelId: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro',
    aliases: ['gemini-3-pro', 'gemini3-pro', 'gemini-pro-3', 'gemini-pro'],
    family: 'gemini-3',
    version: '3',
    contextWindow: 2097152,
    maxOutputTokens: 16384,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'high',
    releaseDate: '2025-11-18',
    metadata: { multimodal: true, benchmarkLeader: true },
  },
  
  'google/gemini-3-deep-think': {
    modelId: 'google/gemini-3-deep-think',
    vendorId: 'google',
    vendorModelId: 'gemini-3-deep-think',
    displayName: 'Gemini 3 Deep Think',
    aliases: ['gemini-3-deep-think', 'gemini-deep-think', 'gemini-thinking'],
    family: 'gemini-3',
    version: '3',
    contextWindow: 2097152,
    maxOutputTokens: 32768,
    capabilities: { ...REASONING_CAPABILITIES },
    status: 'active',
    laneAvailability: ['business', 'enterprise'],
    costTier: 'premium',
    releaseDate: '2025-11-18',
    metadata: { multimodal: true, deepReasoning: true },
  },
  
  'google/gemini-3-flash': {
    modelId: 'google/gemini-3-flash',
    vendorId: 'google',
    vendorModelId: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    aliases: ['gemini-3-flash', 'gemini-flash-3', 'gemini-flash'],
    family: 'gemini-3',
    version: '3',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES, reasoning: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    releaseDate: '2025-11-18',
    metadata: { multimodal: true },
  },
  
  // Gemini 2.5 (Previous - still active)
  'google/gemini-2.5-pro': {
    modelId: 'google/gemini-2.5-pro',
    vendorId: 'google',
    vendorModelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    aliases: ['gemini-2.5-pro', 'gemini-25-pro'],
    family: 'gemini-2.5',
    version: '2.5',
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'medium',
    successorModelId: 'google/gemini-3-pro',
    metadata: { multimodal: true },
  },
  
  // Gemini 2.0
  'google/gemini-2.0-flash': {
    modelId: 'google/gemini-2.0-flash',
    vendorId: 'google',
    vendorModelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    aliases: ['gemini-2.0-flash', 'gemini-2-flash', 'gemini-flash-2'],
    family: 'gemini-2.0',
    version: '2.0',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES, reasoning: true },
    status: 'active',
    laneAvailability: ['all'],
    costTier: 'low',
    metadata: { multimodal: true },
  },
  
  // Gemini 1.5 (Legacy but active)
  'google/gemini-1.5-pro': {
    modelId: 'google/gemini-1.5-pro',
    vendorId: 'google',
    vendorModelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    aliases: ['gemini-1.5-pro', 'gemini-pro-1.5'],
    family: 'gemini-1.5',
    version: '1.5',
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'deprecated',
    laneAvailability: ['all'],
    costTier: 'medium',
    successorModelId: 'google/gemini-2.5-pro',
    metadata: { multimodal: true },
  },
  
  'google/gemini-1.5-flash': {
    modelId: 'google/gemini-1.5-flash',
    vendorId: 'google',
    vendorModelId: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    aliases: ['gemini-1.5-flash', 'gemini-flash-1.5'],
    family: 'gemini-1.5',
    version: '1.5',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    capabilities: { ...FULL_CAPABILITIES },
    status: 'deprecated',
    laneAvailability: ['all'],
    costTier: 'low',
    successorModelId: 'google/gemini-2.0-flash',
    metadata: { multimodal: true },
  },
  
};

/**
 * Alias index for fast lookup
 */
const ALIAS_INDEX: Map<string, string> = new Map();

// Build alias index
for (const [modelId, model] of Object.entries(MODEL_CATALOG)) {
  // Index canonical ID
  ALIAS_INDEX.set(modelId.toLowerCase(), modelId);
  ALIAS_INDEX.set(model.vendorModelId.toLowerCase(), modelId);
  
  // Index all aliases
  for (const alias of model.aliases) {
    ALIAS_INDEX.set(alias.toLowerCase(), modelId);
  }
}

/**
 * Get model by ID or alias
 */
export function getModel(idOrAlias: string): ModelDefinition | undefined {
  const normalizedId = idOrAlias.toLowerCase().trim();
  const canonicalId = ALIAS_INDEX.get(normalizedId);
  
  if (canonicalId) {
    return MODEL_CATALOG[canonicalId];
  }
  
  // Try direct lookup
  return MODEL_CATALOG[idOrAlias];
}

/**
 * Get all models
 */
export function getAllModels(): ModelDefinition[] {
  return Object.values(MODEL_CATALOG);
}

/**
 * Get models by vendor
 */
export function getModelsByVendor(vendorId: string): ModelDefinition[] {
  return getAllModels().filter(m => m.vendorId === vendorId);
}

/**
 * Get models by family
 */
export function getModelsByFamily(family: string): ModelDefinition[] {
  return getAllModels().filter(m => m.family === family);
}

/**
 * Get models available for a lane
 */
export function getModelsForLane(lane: 'self_serve' | 'business' | 'enterprise'): ModelDefinition[] {
  return getAllModels().filter(m => 
    m.laneAvailability.includes(lane) || m.laneAvailability.includes('all')
  );
}

/**
 * Get active models only
 */
export function getActiveModels(): ModelDefinition[] {
  return getAllModels().filter(m => m.status === 'active');
}

/**
 * Search models by capabilities
 */
export function getModelsByCapability(
  capability: keyof ModelCapabilities
): ModelDefinition[] {
  return getAllModels().filter(m => m.capabilities[capability]);
}

/**
 * Find successor for deprecated model
 */
export function getSuccessorModel(modelId: string): ModelDefinition | undefined {
  const model = getModel(modelId);
  if (!model?.successorModelId) return undefined;
  return getModel(model.successorModelId);
}

/**
 * Find closest model in same family
 */
export function findClosestModel(
  modelId: string,
  preferredVendor?: string
): ModelDefinition | undefined {
  const model = getModel(modelId);
  if (!model) return undefined;
  
  // Get models in same family
  const familyModels = getModelsByFamily(model.family)
    .filter(m => m.status === 'active' && m.modelId !== modelId);
  
  if (familyModels.length === 0) return undefined;
  
  // Prefer same vendor
  const sameVendor = familyModels.filter(m => m.vendorId === (preferredVendor || model.vendorId));
  if (sameVendor.length > 0) {
    return sameVendor[0];
  }
  
  return familyModels[0];
}

/**
 * Get model count statistics
 */
export function getModelStats(): {
  total: number;
  active: number;
  deprecated: number;
  byVendor: Record<string, number>;
  byFamily: Record<string, number>;
} {
  const models = getAllModels();
  const byVendor: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  
  for (const model of models) {
    byVendor[model.vendorId] = (byVendor[model.vendorId] || 0) + 1;
    byFamily[model.family] = (byFamily[model.family] || 0) + 1;
  }
  
  return {
    total: models.length,
    active: models.filter(m => m.status === 'active').length,
    deprecated: models.filter(m => m.status === 'deprecated').length,
    byVendor,
    byFamily,
  };
}
