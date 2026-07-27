/**
 * FDA CLIA Waiver Connector
 *
 * Fetches CLIA (Clinical Laboratory Improvement Amendments)
 * waiver determinations from the FDA OpenAPI.
 */

import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const BASE_URL = "https://api.fda.gov/device/clia.json";

interface FdaCliaResult {
  clia_id: string;
  applicant: string;
  device_name: string;
  product_code: string;
  decision_date: string;
  waiver: string;
}

interface FdaApiResponse {
  results: FdaCliaResult[];
  meta: { results: { total: number; skip: number; limit: number } };
}

export async function fetchCliaWaivers(config: CrawlerConfig): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  let skip = 0;
  const limit = 100;
  let total = 0;

  do {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    const url = `${BASE_URL}?${params}`;
    const res = await fetch(url, {
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`FDA CLIA API error: ${res.status} ${res.statusText}`);

    const data = (await res.json()) as FdaApiResponse;
    total = data.meta.results.total;

    for (const item of data.results) {
      signals.push({
        externalId: `fda-clia-${item.clia_id}`,
        source: "fda",
        jurisdiction: "US",
        type: "FDA_CLIA_WAIVER",
        title: `CLIA Waiver — ${item.device_name}`,
        description: `CLIA waiver ${item.clia_id}: ${item.device_name} by ${item.applicant}. Waiver: ${item.waiver}.`,
        date: item.decision_date,
        url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfCLIA/search.cfm`,
        companyName: item.applicant,
        productName: item.device_name,
        productCode: item.product_code,
        metadata: { clia_id: item.clia_id, waiver: item.waiver },
      });
    }
    skip += limit;
    await new Promise((r) => setTimeout(r, 200));
  } while (skip < total && signals.length < config.maxSignalsPerSource);

  return signals;
}
