/**
 * ANVISA Source Connector (Stub)
 *
 * Brazilian Health Regulatory Agency — medical device registrations
 * and conformity certificates.
 *
 * Public data portal: https://dados.anvisa.gov.br/
 *
 * TODO: Implement ANVISA client scraping their public dataset.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class AnvisaSource implements SourceConnector {
  name = "anvisa";
  jurisdiction = "BR" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    // Stub
    return [];
  }
}
