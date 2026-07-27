/**
 * FDA Clearance / 510(k) Connector
 *
 * Fetches premarket notification (510(k)) submissions from the
 * FDA OpenAPI (open.fda.gov). Handles pagination and rate limits.
 */

import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const BASE_URL = "https://api.fda.gov/device/510k.json";

/** Fields returned by the FDA 510(k) API */
interface Fda510kResult {
  k_number: string;
  applicant: string;
  device_name: string;
  product_code: string;
  date_received: string;
  decision_date?: string;
  clearance_type?: string;
  state?: string;
  zip_code?: string;
  address_1?: string;
  city?: string;
}

interface FdaApiResponse {
  results: Fda510kResult[];
  meta: {
    results: { total: number; skip: number; limit: number };
  };
}

export async function fetch510kClearances(
  config: CrawlerConfig,
  sinceDate?: string,
): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  let skip = 0;
  const limit = 100;
  let total = 0;

  do {
    const params = new URLSearchParams({
      limit: String(limit),
      skip: String(skip),
    });
    if (sinceDate) {
      params.set("search", `date_received:[${sinceDate}+TO+*]`);
    }

    const url = `${BASE_URL}?${params}`;
    const res = await fetch(url, {
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`FDA 510(k) API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as FdaApiResponse;
    total = data.meta.results.total;

    for (const item of data.results) {
      signals.push({
        externalId: `fda-510k-${item.k_number}`,
        source: "fda",
        jurisdiction: "US",
        type: "FDA_510K",
        title: `${item.clearance_type ?? "510(k)"} — ${item.device_name}`,
        description: `510(k) ${item.k_number}: ${item.device_name} by ${item.applicant}. Product code: ${item.product_code}.`,
        date: item.decision_date ?? item.date_received,
        url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${item.k_number}`,
        companyName: item.applicant,
        productName: item.device_name,
        productCode: item.product_code,
        metadata: { k_number: item.k_number, state: item.state, clearance_type: item.clearance_type },
      });
    }

    skip += limit;

    // Rate limit: 1 request per 200ms
    await new Promise((r) => setTimeout(r, 200));
  } while (skip < total && signals.length < config.maxSignalsPerSource);

  return signals;
}
