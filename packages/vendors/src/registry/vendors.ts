// ============================================================================
// VENDOR REGISTRY
// All supported AI vendors (Tier 1 Direct + Tier 2 Gateway)
// ============================================================================

import { VendorDefinition } from './types';

/**
 * Complete vendor registry
 * This is the single source of truth for vendor information
 */
export const VENDOR_REGISTRY: Record<string, VendorDefinition> = {
  // =========================================================================
  // TIER 1 — DIRECT MODEL VENDORS
  // =========================================================================
  
  openai: {
    vendorId: 'openai',
    displayName: 'OpenAI',
    tier: 'tier1_direct',
    description: 'OpenAI API - GPT-4, o-series reasoning models',
    apiBaseUrl: 'https://api.openai.com/v1',
    authType: 'api_key',
    supportsRegions: false,
    status: 'active',
    enterpriseOnly: false,
  },
  
  anthropic: {
    vendorId: 'anthropic',
    displayName: 'Anthropic',
    tier: 'tier1_direct',
    description: 'Anthropic API - Claude Opus, Sonnet, Haiku',
    apiBaseUrl: 'https://api.anthropic.com',
    authType: 'api_key',
    supportsRegions: false,
    status: 'active',
    enterpriseOnly: false,
  },
  
  google: {
    vendorId: 'google',
    displayName: 'Google AI',
    tier: 'tier1_direct',
    description: 'Google Generative AI - Gemini Pro, Flash, Ultra',
    apiBaseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'api_key',
    supportsRegions: false,
    status: 'active',
    enterpriseOnly: false,
  },
};

/**
 * Get vendor by ID
 */
export function getVendor(vendorId: string): VendorDefinition | undefined {
  return VENDOR_REGISTRY[vendorId];
}

/**
 * Get all vendors
 */
export function getAllVendors(): VendorDefinition[] {
  return Object.values(VENDOR_REGISTRY);
}

/**
 * Get vendors by tier
 */
export function getVendorsByTier(tier: 'tier1_direct' | 'tier2_gateway'): VendorDefinition[] {
  return getAllVendors().filter(v => v.tier === tier);
}

/**
 * Get non-enterprise vendors (available to all lanes)
 */
export function getPublicVendors(): VendorDefinition[] {
  return getAllVendors().filter(v => !v.enterpriseOnly);
}

/**
 * Check if vendor supports a region
 */
export function vendorSupportsRegion(vendorId: string, region: string): boolean {
  const vendor = getVendor(vendorId);
  if (!vendor) return false;
  if (!vendor.supportsRegions) return true;
  return vendor.regions?.includes(region) ?? false;
}

/**
 * Get gateway vendors that support a specific underlying vendor
 */
export function getGatewaysForVendor(underlyingVendorId: string): VendorDefinition[] {
  return getAllVendors().filter(
    v => v.tier === 'tier2_gateway' && v.gatewayFor?.includes(underlyingVendorId)
  );
}
