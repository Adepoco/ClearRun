// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
// Local rate-limit / abuse labels. Not the closed kernel contract.

export type PlanTier = 'free' | 'pro' | 'business' | 'enterprise';

export type AbuseCategory =
  | 'account_farm'
  | 'credit_abuse'
  | 'routing_abuse'
  | 'evaluation_gaming'
  | 'financial_abuse';

export type DefenseLevel = 'soft_friction' | 'economic_pressure' | 'containment';
