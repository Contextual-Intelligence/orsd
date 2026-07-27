/**
 * TGA Source Connector (Stub)
 *
 * Australian Therapeutic Goods Administration — medical device
 * registrations and conformity assessments.
 *
 * TODO: Implement TGA client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class TgaSource implements SourceConnector {
  name = "tga";
  jurisdiction = "AU" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    return [];
  }
}
