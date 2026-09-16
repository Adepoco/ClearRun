// ============================================================================
// MODEL VENDOR REGISTRY - CORE TYPES
// Single source of truth for all model/vendor information
// ============================================================================

/**
 * Vendor classification tiers
 */
export type VendorTier = 'tier1_direct' | 'tier2_gateway';

/**
 * Model capability flags
 */
export interface ModelCapabilities {
  chat: boolean;
  completion: boolean;
  reasoning: boolean;         // o-series, extended thinking
  toolUse: boolean;           // function calling
  vision: boolean;            // image input
  codeExecution: boolean;     // code interpreter
  streaming: boolean;
  jsonMode: boolean;
  systemInstructions: boolean;
}

/**
 * Model status
 */
export type ModelStatus = 
  | 'active'
  | 'preview'
  | 'beta'
  | 'deprecated'
  | 'discontinued';

/**
 * Product lane availability
 */
export type LaneAvailability = 'self_serve' | 'business' | 'enterprise' | 'all';

/**
 * Vendor definition
 */
export interface VendorDefinition {
  vendorId: string;
  displayName: string;
  tier: VendorTier;
  description: string;
  apiBaseUrl?: string;
  authType: 'api_key' | 'oauth' | 'iam' | 'service_account';
  supportsRegions: boolean;
  regions?: string[];
  // For gateway vendors, which underlying vendors they support
  gatewayFor?: string[];
  status: 'active' | 'preview' | 'deprecated';
  enterpriseOnly: boolean;
}

/**
 * Model definition in the catalog
 */
export interface ModelDefinition {
  modelId: string;              // Internal canonical ID
  vendorId: string;             // Reference to vendor
  vendorModelId: string;        // Actual API model identifier
  displayName: string;
  aliases: string[];            // Alternative names that resolve to this model
  family: string;               // e.g., "gpt-4", "claude-3", "gemini-1.5"
  version?: string;             // e.g., "4.5", "3.5", "1.5"
  contextWindow: number;        // Max tokens
  maxOutputTokens: number;
  capabilities: ModelCapabilities;
  status: ModelStatus;
  laneAvailability: LaneAvailability[];
  costTier: 'low' | 'medium' | 'high' | 'premium';
  releaseDate?: string;
  deprecationDate?: string;
  successorModelId?: string;    // If deprecated, what replaces it
  metadata: Record<string, unknown>;
}

/**
 * Unified request format (vendor-agnostic)
 */
export interface UnifiedRequest {
  messages: UnifiedMessage[];
  systemInstruction?: string;
  tools?: UnifiedTool[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  // Reasoning/thinking flags
  reasoningEnabled?: boolean;
  reasoningBudget?: number;     // For o-series style models
  // Response format
  jsonMode?: boolean;
  responseSchema?: Record<string, unknown>;
  // Streaming
  stream?: boolean;
  // Metadata for tracking
  requestId?: string;
  userId?: string;
}

export interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | UnifiedContentPart[];
  name?: string;                // For tool messages
  toolCallId?: string;          // For tool responses
  toolCalls?: UnifiedToolCall[];
}

export interface UnifiedContentPart {
  type: 'text' | 'image' | 'file';
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  fileUrl?: string;
}

export interface UnifiedTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface UnifiedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Unified response format (vendor-agnostic)
 */
export interface UnifiedResponse {
  // Core content
  content: string;
  toolCalls?: UnifiedToolCall[];
  
  // Token usage
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    reasoningTokens?: number;   // For o-series
    cachedTokens?: number;
  };
  
  // Completion metadata
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  
  // Model info (resolved)
  model: {
    requestedModel: string;
    resolvedModel: string;
    vendorId: string;
    vendorModelId: string;
  };
  
  // Governance-relevant metadata
  governanceMetadata: {
    // Confidence indicators from model (if available)
    confidenceScore?: number;
    uncertaintyMarkers?: string[];
    // Citations/sources (if model provides)
    citations?: Array<{ text: string; source?: string }>;
    // Safety/filter info
    safetyRatings?: Array<{ category: string; probability: string }>;
    // Reasoning trace (for reasoning models)
    reasoningTrace?: string;
  };
  
  // Performance
  latencyMs: number;
  
  // Warnings
  warnings: RegistryWarning[];
}

/**
 * Registry warning (surfaced to UI/audit)
 */
export interface RegistryWarning {
  code: RegistryWarningCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  details?: Record<string, unknown>;
}

export type RegistryWarningCode =
  | 'MODEL_RENAMED'
  | 'MODEL_DEPRECATED'
  | 'MODEL_UNAVAILABLE_IN_LANE'
  | 'MODEL_SUBSTITUTED'
  | 'VENDOR_UNAVAILABLE'
  | 'REGION_RESTRICTED'
  | 'FEATURE_UNSUPPORTED'
  | 'RATE_LIMITED'
  // TEST FIX: Added integrity warning codes
  | 'MODEL_VERIFICATION_FAILED'
  | 'RESPONSE_TRUNCATED';

/**
 * Enterprise model policy
 */
export interface EnterpriseModelPolicy {
  policyId: string;
  organizationId: string;
  
  // Allowlist/blocklist
  allowedVendors?: string[];
  blockedVendors?: string[];
  allowedModels?: string[];
  blockedModels?: string[];
  allowedFamilies?: string[];
  blockedFamilies?: string[];
  
  // Capability restrictions
  requireToolSupport?: boolean;
  requireReasoning?: boolean;
  maxContextWindow?: number;
  
  // Region enforcement
  allowedRegions?: string[];
  blockedRegions?: string[];
  requireRegionalDeployment?: boolean;
  
  // Cost controls
  maxCostTier?: 'low' | 'medium' | 'high' | 'premium';
  
  // Audit requirements
  auditAllModelSubstitutions: boolean;
  requireApprovalForNewModels: boolean;
  
  // Default model when requested is unavailable
  fallbackModel?: string;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Model resolution result
 */
export interface ModelResolution {
  success: boolean;
  resolvedModel?: ModelDefinition;
  resolvedVendor?: VendorDefinition;
  originalRequest: string;
  substituted: boolean;
  warnings: RegistryWarning[];
  blockedReason?: string;
}
