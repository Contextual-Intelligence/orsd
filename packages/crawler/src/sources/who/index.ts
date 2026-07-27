/**
 * WHO Prequalification Source Connector (Stub)
 *
 * World Health Organization — prequalification listings for medical
 * products (IVDs, medicines, vaccines).
 *
 * Data portal: https://extranet.who.int/prequal/
 *
 * TODO: Implement WHO PQ client.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

export class WhoSource implements SourceConnector {
  name = "who";
  jurisdiction = "WHO" as const;

  async fetch(_config: CrawlerConfig): Promise<RawSignal[]> {
    return [];
  }
}
