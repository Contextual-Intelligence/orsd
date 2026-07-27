/**
 * FDA De Novo Classification Connector
 *
 * Fetches De Novo classification requests from the FDA OpenAPI.
 * De Novo is a risk-based classification pathway for novel devices
 * without a predicate.
 */

import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const BASE_URL = "https://api.fda.gov/device/denovo.json";

interface FdaDenovoResult {
  denovo_number: string;
  applicant: string;
  device_name: string;
  product_code: string;
  decision_date: string;
  classification: string;
  device_class: string;
  regulation_number?: string;
}

interface FdaApiResponse {
  results: FdaDenovoResult[];
  meta: { results: { total: number; skip: number; limit: number } };
}

export async function fetchDeNovoClassifications(config: CrawlerConfig): Promise<RawSignal[]> {
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
    if (!res.ok) throw new Error(`FDA De Novo API error: ${res.status} ${res.statusText}`);

    const data = (await res.json()) as FdaApiResponse;
    total = data.meta.results.total;

    for (const item of data.results) {
      signals.push({
        externalId: `fda-denovo-${item.denovo_number}`,
        source: "fda",
        jurisdiction: "US",
        type: "FDA_DE_NOVO",
        title: `De Novo — ${item.device_name}`,
        description: `De Novo ${item.denovo_number}: ${item.device_name} by ${item.applicant}. Classification: ${item.classification}. Class: ${item.device_class}.`,
        date: item.decision_date,
        url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/denovo.cfm?id=${item.denovo_number}`,
        companyName: item.applicant,
        productName: item.device_name,
        productCode: item.product_code,
        metadata: { denovo_number: item.denovo_number, classification: item.classification, device_class: item.device_class },
      });
    }
    skip += limit;
    await new Promise((r) => setTimeout(r, 200));
  } while (skip < total && signals.length < config.maxSignalsPerSource);

  return signals;
}
