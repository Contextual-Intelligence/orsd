/**
 * FDA Source Connector
 *
 * Aggregates: 510(k) clearances, PMA approvals, De Novo classifications,
 * and CLIA waivers — all via the FDA OpenAPI (open.fda.gov).
 *
 * All endpoints use the same pagination pattern: limit + skip,
 * with a 200ms rate limit between requests (5 req/s).
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";
import { fetch510kClearances } from "./clearance.js";
import { fetchPmaApprovals } from "./pma.js";
import { fetchDeNovoClassifications } from "./denovo.js";
import { fetchCliaWaivers } from "./clia.js";

export class FdaSource implements SourceConnector {
  name = "fda";
  jurisdiction = "US" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    const [clearances, pmas, denovos, clias] = await Promise.allSettled([
      fetch510kClearances(config),
      fetchPmaApprovals(config),
      fetchDeNovoClassifications(config),
      fetchCliaWaivers(config),
    ]);

    for (const r of [clearances, pmas, denovos, clias]) {
      if (r.status === "fulfilled") signals.push(...r.value);
    }

    return signals;
  }
}
