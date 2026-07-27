/**
 * FDA Source Connector
 *
 * Aggregates: 510(k) clearances, PMA approvals, De Novo classifications,
 * CLIA waivers, and clinical trials (ClinicalTrials.gov).
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";
import { fetch510kClearances } from "./clearance.js";

export class FdaSource implements SourceConnector {
  name = "fda";
  jurisdiction = "US" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // 510(k) clearances
    const clearances = await fetch510kClearances(config);
    signals.push(...clearances);

    // TODO: Add PMA connector
    // TODO: Add De Novo connector
    // TODO: Add CLIA waiver connector
    // TODO: Add ClinicalTrials.gov connector

    return signals;
  }
}
