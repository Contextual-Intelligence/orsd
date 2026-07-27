/**
 * ORSD Signal Enrichment
 *
 * Matches signals to known companies/products in Dgraph,
 * resolves product codes, and appends additional metadata.
 */

import pino from "pino";
import type { NormalizedSignal } from "../types.js";
import type { CrawlerConfig } from "../config.js";

const logger = pino({ name: "orsd/enrich" });

export async function enrichSignals(
  signals: NormalizedSignal[],
): Promise<NormalizedSignal[]> {
  // For v0.1: enrichment is a no-op (identity).
  // Future: match companyName against Dgraph companies, resolve
  // product codes, look up segment/region for company metadata.
  //
  // Phase 2 enhancements:
  //   - Query Dgraph for company by normalizedName
  //   - Attach company segment/region/tier to signal metadata
  //   - Cross-reference product codes across jurisdictions
  //   - Detect related signals (e.g., same product in different jurisdictions)

  logger.info({ count: signals.length }, "Enrichment pass complete (no-op for v0.1)");
  return signals;
}
