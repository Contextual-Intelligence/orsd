/**
 * PMDA Source Connector (Stub)
 *
 * Japan Pharmaceuticals and Medical Devices Agency — approvals,
 * certifications, and safety information.
 *
 * Public data: https://www.pmda.go.jp/english/
 *
 * TODO: Implement PMDA client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class PmdaSource implements SourceConnector {
  name = "pmda";
  jurisdiction = "JP" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    // Stub
    return [];
  }
}
