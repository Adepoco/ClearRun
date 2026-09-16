// ============================================================================
// CENTRALIZED CONFIGURATION — MID-010 FIX
// All configurable values in one place for consistency
// ============================================================================

/**
 * Adapter timeout configuration
 * MID-010: Standardized across all adapters
 * 
 * IMPORTANT: Default timeout must be LESS than API route timeout (60s)
 * to ensure clean error handling before the route times out
 */
export const ADAPTER_TIMEOUTS = {
  /** Default timeout for all adapters (55s < 60s route timeout) */
  DEFAULT: 55000,
  
  /** Extended timeout for known slow providers */
  EXTENDED: 110000,

  getForProvider(_provider: string): number {
    return this.DEFAULT;
  },
} as const;

/**
 * Input validation limits
 * MID-007: Standardized input limits
 */
export const INPUT_LIMITS = {
  /** Max chat message length */
  MAX_MESSAGE_LENGTH: 32000,
  
  /** Max evaluate content length */
  MAX_CONTENT_LENGTH: 100000,
  
  /** Max context messages */
  MAX_CONTEXT_MESSAGES: 50,
  
  /** Max prompt length */
  MAX_PROMPT_LENGTH: 32000,
  
  /** Max workspace name length */
  MAX_NAME_LENGTH: 100,
  
  /** Max description length */
  MAX_DESCRIPTION_LENGTH: 500,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  /** Default window size in ms */
  WINDOW_MS: 60000,
  
  /** Free tier limits */
  FREE: {
    requests_per_minute: 10,
    requests_per_hour: 50,
    requests_per_day: 200,
  },
  
  /** Team tier limits */
  TEAM: {
    requests_per_minute: 30,
    requests_per_hour: 300,
    requests_per_day: 2000,
  },
  
  /** Enterprise tier limits */
  ENTERPRISE: {
    requests_per_minute: 100,
    requests_per_hour: 1000,
    requests_per_day: 10000,
  },
} as const;

/**
 * Abuse detection thresholds
 * MID-006: Centralized abuse thresholds
 */
export const ABUSE_THRESHOLDS = {
  /** Max accounts from same IP in 24h */
  MAX_ACCOUNTS_PER_IP_24H: 3,
  
  /** Max requests per minute before flagging */
  MAX_REQUESTS_PER_MINUTE: 60,
  
  /** Minimum interval between requests (ms) - bot detection */
  MIN_REQUEST_INTERVAL_MS: 100,
  
  /** Credit consumption ratio that triggers farming alert */
  CREDIT_FARMING_RATIO: 0.9,
  
  /** Different user agents from same user that triggers alert */
  SUSPICIOUS_USER_AGENT_CHANGES: 5,
} as const;

/**
 * Scoring configuration
 * Matches INNER phase locks
 */
export const SCORING_CONFIG = {
  /** Score bounds */
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  
  /** Governance adjustment bounds */
  MAX_GOVERNANCE_ADJUSTMENT: 50,
  
  /** Minimum claims for evaluation */
  MIN_CLAIMS_FOR_EVALUATION: 1,
  
  /** Maximum claims to process */
  MAX_CLAIMS: 100,
} as const;

/**
 * Collection size limits
 * MID-012: Prevent unbounded memory growth
 */
export const COLLECTION_LIMITS = {
  /** Max items in caches */
  MAX_CACHE_SIZE: 10000,
  
  /** Max items in rate limit tracking */
  MAX_RATE_LIMIT_ENTRIES: 50000,
  
  /** Max items in abuse tracking */
  MAX_ABUSE_TRACKING_ENTRIES: 100000,
  
  /** Max governance findings per evaluation */
  MAX_GOVERNANCE_FINDINGS: 100,
} as const;

/**
 * Regex safety configuration
 * MID-008: ReDoS protection
 */
export const REGEX_CONFIG = {
  /** Max input length for regex operations */
  MAX_INPUT_LENGTH: 50000,
  
  /** Default timeout for regex operations */
  DEFAULT_TIMEOUT_MS: 100,
  
  /** Max replacements per operation */
  MAX_REPLACEMENTS: 1000,
} as const;

// Type exports for use in other modules
export type AdapterTimeout = typeof ADAPTER_TIMEOUTS;
export type InputLimit = typeof INPUT_LIMITS;
export type RateLimit = typeof RATE_LIMITS;
export type AbuseThreshold = typeof ABUSE_THRESHOLDS;
