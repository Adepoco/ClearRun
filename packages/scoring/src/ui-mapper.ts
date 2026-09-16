// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
/**
 * UI Mapper (OPEN, presentational only)
 *
 * Maps a finished public Verdict to a UI-safe display. It performs NO scoring
 * and reads NO governance internals — it depends solely on the public verdict
 * contract in @clearrun/core-types. The closed kernel has already produced the
 * score, grade, failure categories, and (optionally) UI-safe component signals.
 *
 * RULES:
 * - Never show a number alone (always paired with a label).
 * - Scores are contextual, not declarative.
 * - Never say "Correct", "Safe", "Approved", "Trusted".
 */

import type {
  Verdict,
  VerdictDisplay,
  VerdictGrade,
  ComponentIndicator,
} from '@clearrun/core-types';

/** Max words allowed in the short reason surfaced to end users. */
const MAX_REASON_WORDS = 16;

export class UIMapper {
  /**
   * Project a public Verdict onto a UI-safe display. Purely presentational.
   */
  mapToDisplay(verdict: Verdict): VerdictDisplay {
    return {
      score: verdict.score,
      label: this.resolveLabel(verdict.grade),
      shortReason: this.truncateReason(verdict.summary),
      componentIndicators: this.mapComponentIndicators(verdict),
    };
  }

  /** Grade IS the label; falls back to "Not configured" when score is absent. */
  private resolveLabel(grade: VerdictGrade): VerdictGrade {
    return grade ?? 'Not configured';
  }

  /** Enforce the <=16-word rule on the kernel-provided summary. */
  private truncateReason(summary: string): string {
    const words = (summary ?? '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= MAX_REASON_WORDS) {
      return words.join(' ');
    }
    return words.slice(0, MAX_REASON_WORDS).join(' ') + '…';
  }

  /** Render kernel-provided component signals as UI bars. No derivation here. */
  private mapComponentIndicators(verdict: Verdict): ComponentIndicator[] | undefined {
    if (!verdict.componentSignals || verdict.componentSignals.length === 0) {
      return undefined;
    }
    return verdict.componentSignals.map((signal) => ({
      name: signal.name,
      level: signal.level,
      description: signal.note ?? '',
    }));
  }
}

/** Singleton instance for convenience. */
export const uiMapper = new UIMapper();
