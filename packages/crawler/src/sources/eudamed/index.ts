/**
 * EUDAMED Source Connector (Stub)
 *
 * EUDAMED (European Database on Medical Devices) provides
 * certificates, notified body opinions, clinical investigation
 * records, and legacy device data.
 *
 * API: https://ec.europa.eu/tools/eudamed/api
 *
 * TODO: Implement EUDAMED API client when public API becomes available.
 * For now, this uses the publicly available CSV/XML dumps.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class EudamedSource implements SourceConnector {
  name = "eudamed";
  jurisdiction = "EU" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    // Stub — return empty until EUDAMED API integration is built
    return [];
  }
}
