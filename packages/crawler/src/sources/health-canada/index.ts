/**
 * Health Canada Source Connector (Stub)
 *
 * Health Canada — medical device licenses (MDL) and medical device
 * establishment licenses (MDEL).
 *
 * TODO: Implement Health Canada client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class HealthCanadaSource implements SourceConnector {
  name = "health_canada";
  jurisdiction = "CA" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    return [];
  }
}
