/**
 * NMPA Source Connector (Stub)
 *
 * China National Medical Products Administration — medical device
 * approvals and registrations.
 *
 * TODO: Implement NMPA client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class NmpaSource implements SourceConnector {
  name = "nmpa";
  jurisdiction = "CN" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    return [];
  }
}
