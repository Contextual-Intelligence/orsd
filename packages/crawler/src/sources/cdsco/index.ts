/**
 * CDSCO Source Connector (Stub)
 *
 * India Central Drugs Standard Control Organization — medical
 * device registrations and import licenses.
 *
 * Public portal: https://cdscoonline.gov.in/
 *
 * TODO: Implement CDSCO client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class CdscoSource implements SourceConnector {
  name = "cdsco";
  jurisdiction = "IN" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    // Stub
    return [];
  }
}
