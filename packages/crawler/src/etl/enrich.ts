/**
 * ORSD Signal Enrichment
 *
 * Phase 1: Basic enrichment (v0.1)
 *   - Normalize company names (trim, collapse whitespace)
 *   - Strip legal suffixes for fuzzy matching
 *   - Set default signal title if missing
 *
 * Phase 2: Deep enrichment (future)
 *   - Match companyName against Dgraph company registry
 *   - Resolve product codes to canonical product names
 *   - Cross-reference signals across jurisdictions (same product, different country)
 *   - Attach company segment/region/tier metadata
 *   - Detect related signal clusters
 */

import pino from "pino";
import type { NormalizedSignal } from "../types.js";

const logger = pino({ name: "orsd/enrich" });

/**
 * Common legal suffixes to strip for name normalization.
 * Includes both dotted (B.V., N.V.) and plain (BV, NV) variants.
 */
const LEGAL_SUFFIXES = /\b(Inc|LLC|Ltd|Limited|GmbH|AG|SA|SAS|SpA|AB|OY|NV|BV|Pty|Co|Corp|Corporation|Company|PLC|KK|YK|ZA|OOO|AO)\.?\s*$/i;

/**
 * Variants with internal dots (B.V. → BV, N.V. → NV, S.A. → SA).
 * Applied AFTER dot-removal normalization.
 */
const LEGAL_SUFFIXES_DOTTED = /\b(B\.V\.|N\.V\.|S\.A\.|S\.p\.A\.|Inc\.|Ltd\.|LLC\.|Co\.)\s*$/i;

/** Common stop words in company names. */
const STOP_WORDS = /\b(the|and|of|for|in|a|an|&)\b/gi;

/**
 * Normalize a company name for matching:
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Remove periods from suffix-like contexts
 * - Strip legal suffixes (dotted and plain)
 * - Lowercase
 */
function normalizeCompanyName(name: string): string {
  let clean = name.trim().replace(/\s+/g, " ");

  // Step 1: Try matching dotted suffixes (B.V., N.V., S.A., etc.)
  clean = clean.replace(LEGAL_SUFFIXES_DOTTED, "");

  // Step 2: Remove periods at word boundaries (turns "B.V." into "BV"
  // for the plain suffix regex to catch)
  clean = clean.replace(/(\b\w)\.(?=\s|$)/g, "$1");

  // Step 3: Strip plain legal suffixes
  clean = clean.replace(LEGAL_SUFFIXES, "");

  // Step 4: Remove stop words
  clean = clean.replace(STOP_WORDS, "");

  return clean.trim().toLowerCase();
}

export async function enrichSignals(
  signals: NormalizedSignal[],
): Promise<NormalizedSignal[]> {
  let enriched = 0;

  for (const signal of signals) {
    // Phase 1: Company name normalization
    if (signal.companyName) {
      const normalized = normalizeCompanyName(signal.companyName);
      const wasModified = normalized !== signal.companyName.toLowerCase().trim();
      if (wasModified) {
        signal.metadata = {
          ...signal.metadata,
          _originalName: signal.companyName,
          _normalizedName: normalized,
        };
      }
      signal.companyName = normalized;
      enriched++;
    }

    // Phase 1: Ensure description has at least some content
    if (!signal.description || signal.description.trim().length < 10) {
      signal.description = buildFallbackDescription(signal);
    }
  }

  logger.info({ count: signals.length, enriched }, "Enrichment complete");

  return signals;
}

/**
 * Build a fallback description from available signal fields
 * when the source didn't provide one.
 */
function buildFallbackDescription(signal: NormalizedSignal): string {
  const parts: string[] = [];

  if (signal.companyName) parts.push(signal.companyName);

  const typeLabel = signal.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  parts.push(typeLabel);

  if (signal.productName) parts.push(`for ${signal.productName}`);
  if (signal.productCode) parts.push(`(code: ${signal.productCode})`);
  if (signal.jurisdiction) parts.push(`in ${signal.jurisdiction}`);

  parts.push(`— sourced from ${signal.source}.`);

  return parts.join(" ");
}
