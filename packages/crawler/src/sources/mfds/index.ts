/**
 * MFDS Source Connector (Stub)
 *
 * South Korea Ministry of Food and Drug Safety — medical device
 * approvals and certifications.
 *
 * TODO: Implement MFDS client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class MfdsSource implements SourceConnector {
  name = "mfds";
  jurisdiction = "KR" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    return [];
  }
}
