/**
 * ORSD Confidence Scoring
 *
 * Assigns a confidence level to each normalized signal based on
 * source reliability, completeness, and consistency heuristics.
 */

import type { NormalizedSignal, Confidence } from "../types.js";

/** Source reliability weight (0-1) */
const SOURCE_RELIABILITY: Record<string, number> = {
  fda: 0.95,
  eudamed: 0.90,
  anvisa: 0.85,
  pmda: 0.80,
  cdsco: 0.70,
  nmpa: 0.70,
  tga: 0.85,
  health_canada: 0.85,
  mfds: 0.75,
  who: 0.90,
  clinicaltrials: 0.80,
  "eu-legislation": 0.95, // official EUR-Lex metadata — highly reliable
  news: 0.50,
};

export function scoreConfidence(signals: NormalizedSignal[]): NormalizedSignal[] {
  return signals.map((signal) => ({
    ...signal,
    confidence: computeConfidence(signal),
  }));
}

function computeConfidence(signal: NormalizedSignal): Confidence {
  const baseReliability = SOURCE_RELIABILITY[signal.source] ?? 0.3;

  // Bonus for having key fields
  let score = baseReliability;
  if (signal.companyName) score += 0.1;
  if (signal.productCode) score += 0.05;
  if (signal.description && signal.description.length > 50) score += 0.05;
  if (signal.url) score += 0.05;
  if (signal.metadata && Object.keys(signal.metadata).length > 0) score += 0.02;

  // Cap at 1.0
  score = Math.min(score, 1.0);

  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}
