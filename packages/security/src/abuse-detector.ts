/**
 * Abuse Detection System (Patch 10)
 * 
 * Detects and responds to abuse across accounts, credits, routing, and evaluation.
 * Defense is economic first, technical second.
 * 
 * PRINCIPLE: Every free surface becomes an attack surface unless economically constrained.
 */

import type { AbuseCategory, DefenseLevel } from './types';

// ============================================================================
// Abuse Signal Types
// ============================================================================

interface AccountSignals {
  accountAge: number; // days
  evaluationVelocity: number; // evals per hour
  workspaceChurn: number; // changes per month
  ipEntropy: number; // 0-1 (higher = more IPs used)
  deviceStability: number; // 0-1 (higher = more consistent)
}

interface SessionSignals {
  repeatedPrompts: number;
  rapidMutation: boolean;
  burstTiming: boolean;
  retryClustering: number;
}

interface EconomicSignals {
  creditBurnSlope: number; // credits per hour
  evalToOutputRatio: number;
  upgradePatterns: number; // suspicious upgrade/downgrade cycles
  costClassSkew: number; // preference for expensive models
}

// ============================================================================
// Abuse Risk Score (ARS)
// ============================================================================

export interface AbuseRiskResult {
  score: number; // 0-1
  primaryCategory: AbuseCategory | null;
  defenseLevel: DefenseLevel | null;
  signals: string[];
  recommendations: string[];
}

// ============================================================================
// Abuse Detector Class
// ============================================================================

export class AbuseDetector {
  // Thresholds for ARS levels
  private readonly LOW_THRESHOLD = 0.3;
  private readonly MODERATE_THRESHOLD = 0.6;
  private readonly HIGH_THRESHOLD = 0.8;
  
  /**
   * Calculate Abuse Risk Score for an account/session
   */
  calculateARS(
    accountSignals: Partial<AccountSignals>,
    sessionSignals: Partial<SessionSignals>,
    economicSignals: Partial<EconomicSignals>
  ): AbuseRiskResult {
    const signals: string[] = [];
    let score = 0;
    let primaryCategory: AbuseCategory | null = null;
    let maxCategoryScore = 0;
    
    // Account-level scoring
    const accountScore = this.scoreAccountSignals(accountSignals, signals);
    if (accountScore > maxCategoryScore) {
      maxCategoryScore = accountScore;
      primaryCategory = 'account_farm';
    }
    score += accountScore * 0.3;
    
    // Session-level scoring
    const sessionScore = this.scoreSessionSignals(sessionSignals, signals);
    if (sessionScore > maxCategoryScore) {
      maxCategoryScore = sessionScore;
      primaryCategory = 'evaluation_gaming';
    }
    score += sessionScore * 0.35;
    
    // Economic scoring
    const economicScore = this.scoreEconomicSignals(economicSignals, signals);
    if (economicScore > maxCategoryScore) {
      maxCategoryScore = economicScore;
      primaryCategory = 'credit_abuse';
    }
    score += economicScore * 0.35;
    
    // Determine defense level
    const defenseLevel = this.getDefenseLevel(score);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(score, signals);
    
    return {
      score: Math.min(1, score),
      primaryCategory: score > this.LOW_THRESHOLD ? primaryCategory : null,
      defenseLevel,
      signals,
      recommendations,
    };
  }
  
  /**
   * Score account-level signals
   */
  private scoreAccountSignals(signals: Partial<AccountSignals>, output: string[]): number {
    let score = 0;
    
    // New accounts are higher risk
    if (signals.accountAge !== undefined) {
      if (signals.accountAge < 1) {
        score += 0.3;
        output.push('Very new account (<1 day)');
      } else if (signals.accountAge < 7) {
        score += 0.1;
        output.push('New account (<7 days)');
      }
    }
    
    // High evaluation velocity
    if (signals.evaluationVelocity !== undefined) {
      if (signals.evaluationVelocity > 100) {
        score += 0.4;
        output.push('Extremely high evaluation velocity');
      } else if (signals.evaluationVelocity > 50) {
        score += 0.2;
        output.push('High evaluation velocity');
      }
    }
    
    // High IP entropy (many different IPs)
    if (signals.ipEntropy !== undefined && signals.ipEntropy > 0.8) {
      score += 0.2;
      output.push('High IP address variation');
    }
    
    // Low device stability
    if (signals.deviceStability !== undefined && signals.deviceStability < 0.3) {
      score += 0.2;
      output.push('Low device fingerprint stability');
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Score session-level signals
   */
  private scoreSessionSignals(signals: Partial<SessionSignals>, output: string[]): number {
    let score = 0;
    
    // Repeated similar prompts
    if (signals.repeatedPrompts !== undefined && signals.repeatedPrompts > 10) {
      score += 0.3;
      output.push('Many repeated similar prompts');
    }
    
    // Rapid prompt mutation (probing behavior)
    if (signals.rapidMutation) {
      score += 0.3;
      output.push('Rapid prompt mutation detected');
    }
    
    // Burst timing
    if (signals.burstTiming) {
      score += 0.2;
      output.push('Burst evaluation timing');
    }
    
    // Retry clustering
    if (signals.retryClustering !== undefined && signals.retryClustering > 5) {
      score += 0.2;
      output.push('High retry clustering');
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Score economic signals
   */
  private scoreEconomicSignals(signals: Partial<EconomicSignals>, output: string[]): number {
    let score = 0;
    
    // High credit burn rate
    if (signals.creditBurnSlope !== undefined) {
      if (signals.creditBurnSlope > 50) {
        score += 0.4;
        output.push('Very high credit burn rate');
      } else if (signals.creditBurnSlope > 20) {
        score += 0.2;
        output.push('High credit burn rate');
      }
    }
    
    // Low value evaluations
    if (signals.evalToOutputRatio !== undefined && signals.evalToOutputRatio < 0.1) {
      score += 0.2;
      output.push('Low evaluation-to-output ratio');
    }
    
    // Suspicious upgrade patterns
    if (signals.upgradePatterns !== undefined && signals.upgradePatterns > 3) {
      score += 0.3;
      output.push('Suspicious plan upgrade/downgrade patterns');
    }
    
    // Forcing expensive models
    if (signals.costClassSkew !== undefined && signals.costClassSkew > 0.9) {
      score += 0.2;
      output.push('Consistently selecting highest-cost models');
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Determine defense level based on score
   */
  private getDefenseLevel(score: number): DefenseLevel | null {
    if (score >= this.HIGH_THRESHOLD) {
      return 'containment';
    } else if (score >= this.MODERATE_THRESHOLD) {
      return 'economic_pressure';
    } else if (score >= this.LOW_THRESHOLD) {
      return 'soft_friction';
    }
    return null;
  }
  
  /**
   * Generate defense recommendations
   */
  private generateRecommendations(score: number, signals: string[]): string[] {
    const recommendations: string[] = [];
    
    if (score >= this.HIGH_THRESHOLD) {
      recommendations.push('Consider manual review');
      recommendations.push('Enable evaluation-only mode');
      recommendations.push('Suspend API access if applicable');
    } else if (score >= this.MODERATE_THRESHOLD) {
      recommendations.push('Apply daily evaluation caps');
      recommendations.push('Require overage confirmation');
      recommendations.push('Remove fallback routing');
    } else if (score >= this.LOW_THRESHOLD) {
      recommendations.push('Slow evaluation cadence');
      recommendations.push('Reduce free-tier credits');
      recommendations.push('Delay high-cost model access');
    }
    
    return recommendations;
  }
  
  /**
   * Check if a specific action should be blocked
   */
  shouldBlock(ars: AbuseRiskResult, action: 'evaluate' | 'generate_artifact' | 'api_access'): boolean {
    if (ars.defenseLevel === 'containment') {
      // Block most actions at containment level
      return action !== 'evaluate'; // Still allow basic evaluation
    }
    return false;
  }
  
  /**
   * Get rate limit multiplier based on ARS
   */
  getRateLimitMultiplier(ars: AbuseRiskResult): number {
    switch (ars.defenseLevel) {
      case 'containment':
        return 0.1; // 10% of normal rate
      case 'economic_pressure':
        return 0.5; // 50% of normal rate
      case 'soft_friction':
        return 0.75; // 75% of normal rate
      default:
        return 1.0; // Normal rate
    }
  }
}

// Export singleton
export const abuseDetector = new AbuseDetector();
