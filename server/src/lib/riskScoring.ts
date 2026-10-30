import { AbuseReportReason, ModerationPriority } from '@prisma/client';

export interface RiskEvaluationInput {
  reportCount: number;
  distinctReporterCount: number;
  reasons: AbuseReportReason[];
  isRapidRepetition?: boolean;
  hasPreviousModerationAction?: boolean;
}

export interface RiskEvaluationResult {
  riskScore: number;
  priority: ModerationPriority;
  riskFactors: string[];
}

/**
 * Calculates an explainable, transparent risk triage score (0 - 100) for moderation cases.
 *
 * CRITICAL CIVIC INTEGRITY RULE:
 * This scoring is strictly for human moderator prioritization in the triage queue.
 * It NEVER automatically removes, hides, deletes, or alters content or public complaints.
 * Criticism of public administration, government departments, or officials is legitimate
 * democratic discourse and is NEVER flagged as high risk.
 */
export function evaluateModerationRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  let score = 0;
  const factors: string[] = [];

  // 1. Report Volume & Distinct Citizen Reporters
  if (input.distinctReporterCount >= 5) {
    score += 40;
    factors.push('HIGH_CITIZEN_REPORT_VOLUME');
  } else if (input.distinctReporterCount >= 3) {
    score += 25;
    factors.push('MULTIPLE_REPORTERS');
  } else if (input.reportCount >= 1) {
    score += 15;
    factors.push('FLAGGED_BY_COMMUNITY');
  }

  // 2. High-Severity Reason Categories
  if (input.reasons.includes(AbuseReportReason.PERSONAL_DATA_EXPOSURE)) {
    score += 35;
    factors.push('PERSONAL_DATA_EXPOSURE_RISK');
  }
  if (input.reasons.includes(AbuseReportReason.HARASSMENT)) {
    score += 30;
    factors.push('HARASSMENT_ALLEGATION');
  }
  if (input.reasons.includes(AbuseReportReason.MALICIOUS_OR_SUSPICIOUS)) {
    score += 25;
    factors.push('MALICIOUS_CONTENT_SIGNAL');
  }
  if (input.reasons.includes(AbuseReportReason.IMPERSONATION)) {
    score += 20;
    factors.push('IMPERSONATION_CONCERN');
  }
  if (input.reasons.includes(AbuseReportReason.SPAM)) {
    score += 15;
    factors.push('AUTOMATED_OR_SPAM_PATTERN');
  }

  // 3. Behavioral signals
  if (input.isRapidRepetition) {
    score += 20;
    factors.push('RAPID_REPETITION_BURST');
  }

  if (input.hasPreviousModerationAction) {
    score += 15;
    factors.push('PRIOR_CONFIRMED_VIOLATIONS');
  }

  // Cap score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  // Determine triage priority
  let priority: ModerationPriority = ModerationPriority.LOW;
  if (finalScore >= 75) {
    priority = ModerationPriority.URGENT;
  } else if (finalScore >= 50) {
    priority = ModerationPriority.HIGH;
  } else if (finalScore >= 25) {
    priority = ModerationPriority.MEDIUM;
  }

  return {
    riskScore: finalScore,
    priority,
    riskFactors: factors,
  };
}
