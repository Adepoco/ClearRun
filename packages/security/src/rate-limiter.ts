/**
 * Rate Limiter (Patch 10)
 * 
 * Tier-based rate limiting with abuse-aware adjustments.
 */

import type { PlanTier } from './types';

// ============================================================================
// Rate Limit Configuration
// ============================================================================

interface RateLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

const TIER_RATE_LIMITS: Record<PlanTier, RateLimits> = {
  free: {
    requestsPerMinute: 5,
    requestsPerHour: 30,
    requestsPerDay: 100,
  },
  pro: {
    requestsPerMinute: 20,
    requestsPerHour: 200,
    requestsPerDay: 1000,
  },
  business: {
    requestsPerMinute: 60,
    requestsPerHour: 600,
    requestsPerDay: 5000,
  },
  enterprise: {
    requestsPerMinute: 300,
    requestsPerHour: 3000,
    requestsPerDay: -1, // Unlimited
  },
};

// ============================================================================
// Rate Limiter Class
// ============================================================================

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets: Map<string, {
    minute: RateLimitBucket;
    hour: RateLimitBucket;
    day: RateLimitBucket;
  }> = new Map();
  
  /**
   * Check if request is allowed
   */
  checkLimit(
    accountId: string,
    planTier: PlanTier,
    multiplier: number = 1.0
  ): { allowed: boolean; retryAfter?: number; reason?: string } {
    const limits = TIER_RATE_LIMITS[planTier];
    const now = Date.now();
    
    // Get or create buckets for this account
    let bucket = this.buckets.get(accountId);
    if (!bucket) {
      bucket = {
        minute: { count: 0, resetAt: now + 60000 },
        hour: { count: 0, resetAt: now + 3600000 },
        day: { count: 0, resetAt: now + 86400000 },
      };
      this.buckets.set(accountId, bucket);
    }
    
    // Reset buckets if expired
    if (now >= bucket.minute.resetAt) {
      bucket.minute = { count: 0, resetAt: now + 60000 };
    }
    if (now >= bucket.hour.resetAt) {
      bucket.hour = { count: 0, resetAt: now + 3600000 };
    }
    if (now >= bucket.day.resetAt) {
      bucket.day = { count: 0, resetAt: now + 86400000 };
    }
    
    // Apply multiplier to limits
    const adjustedLimits = {
      minute: Math.floor(limits.requestsPerMinute * multiplier),
      hour: Math.floor(limits.requestsPerHour * multiplier),
      day: limits.requestsPerDay === -1 ? -1 : Math.floor(limits.requestsPerDay * multiplier),
    };
    
    // Check per-minute limit
    if (bucket.minute.count >= adjustedLimits.minute) {
      return {
        allowed: false,
        retryAfter: Math.ceil((bucket.minute.resetAt - now) / 1000),
        reason: 'Rate limit exceeded (per minute)',
      };
    }
    
    // Check per-hour limit
    if (bucket.hour.count >= adjustedLimits.hour) {
      return {
        allowed: false,
        retryAfter: Math.ceil((bucket.hour.resetAt - now) / 1000),
        reason: 'Rate limit exceeded (per hour)',
      };
    }
    
    // Check per-day limit
    if (adjustedLimits.day !== -1 && bucket.day.count >= adjustedLimits.day) {
      return {
        allowed: false,
        retryAfter: Math.ceil((bucket.day.resetAt - now) / 1000),
        reason: 'Rate limit exceeded (per day)',
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Record a request
   */
  recordRequest(accountId: string): void {
    const bucket = this.buckets.get(accountId);
    if (bucket) {
      bucket.minute.count++;
      bucket.hour.count++;
      bucket.day.count++;
    }
  }
  
  /**
   * Get current usage stats
   */
  getUsage(accountId: string): { minute: number; hour: number; day: number } | null {
    const bucket = this.buckets.get(accountId);
    if (!bucket) return null;
    
    return {
      minute: bucket.minute.count,
      hour: bucket.hour.count,
      day: bucket.day.count,
    };
  }
  
  /**
   * Reset limits for account (admin function)
   */
  resetLimits(accountId: string): void {
    this.buckets.delete(accountId);
  }
}

// Export singleton
export const rateLimiter = new RateLimiter();
