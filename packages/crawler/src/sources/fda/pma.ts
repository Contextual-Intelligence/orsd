/**
 * FDA PMA (Premarket Approval) Connector
 *
 * Fetches PMA approvals from the FDA OpenAPI (open.fda.gov).
 * PMA is the most stringent FDA device review pathway.
 */

import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const BASE_URL = "https://api.fda.gov/device/pma.json";

interface FdaPmaResult {
  pma_number: string;
  applicant: string;
  device_name: string;
  product_code: string;
  date_received: string;
  decision_date?: string;
  supptype?: string;
  advisory_committee?: string;
}

interface FdaApiResponse {
  results: FdaPmaResult[];
  meta: { results: { total: number; skip: number; limit: number } };
}

export async function fetchPmaApprovals(config: CrawlerConfig): Promise<RawSignal[]> {
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
    if (!res.ok) throw new Error(`FDA PMA API error: ${res.status} ${res.statusText}`);

    const data = (await res.json()) as FdaApiResponse;
    total = data.meta.results.total;

    for (const item of data.results) {
      signals.push({
        externalId: `fda-pma-${item.pma_number}`,
        source: "fda",
        jurisdiction: "US",
        type: "FDA_PMA",
        title: `PMA — ${item.device_name}`,
        description: `PMA ${item.pma_number}: ${item.device_name} by ${item.applicant}. Product code: ${item.product_code}. Supplement: ${item.supptype ?? "original"}.`,
        date: item.decision_date ?? item.date_received,
        url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=${item.pma_number}`,
        companyName: item.applicant,
        productName: item.device_name,
        productCode: item.product_code,
        metadata: { pma_number: item.pma_number, supptype: item.supptype, advisory_committee: item.advisory_committee },
      });
    }
    skip += limit;
    await new Promise((r) => setTimeout(r, 200));
  } while (skip < total && signals.length < config.maxSignalsPerSource);

  return signals;
}
