/**
 * WHO Prequalification Source Connector
 *
 * World Health Organization — Prequalification (PQ) of medical products.
 *
 * The WHO PQ programme evaluates medical products (IVDs, medicines,
 * vaccines) for quality, safety, and efficacy. Public data is available
 * through:
 *
 *   - WHO PQ API: https://extranet.who.int/prequal/api
 *   - PQ data exports: https://extranet.who.int/prequal/data
 *   - PQ portal: https://extranet.who.int/prequal/
 *
 * The API provides downloadable lists of prequalified products in JSON/CSV
 * format, including manufacturer, product name, PQ date, and product code.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const PQ_API_BASE = "https://extranet.who.int/prequal/api/v1";
const PQ_PORTAL = "https://extranet.who.int/prequal/";

interface WhoPqProduct {
  id?: number;
  whoPqId?: string;
  productName?: string;
  manufacturer?: string;
  manufacturerCountry?: string;
  productCategory?: string;
  productSubcategory?: string;
  prequalificationDate?: string;
  status?: string;
  productCode?: string;
  description?: string;
  website?: string;
}

export class WhoSource implements SourceConnector {
  name = "who";
  jurisdiction = "WHO" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Attempt 1: WHO PQ API — fetch prequalified IVDs and medical devices
    const endpoints = [
      "/prequalified-products?category=ivd",
      "/prequalified-products?category=medical-device",
    ];

    for (const ep of endpoints) {
      try {
        let page = 1;
        let hasMore = true;

        while (hasMore && signals.length < config.maxSignalsPerSource) {
          const url = `${PQ_API_BASE}${ep}&page=${page}&page_size=100`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": config.userAgent,
              "Accept": "application/json",
            },
            signal: AbortSignal.timeout(20_000),
          });

          if (!res.ok) {
            if (res.status === 404) break; // endpoint may not exist yet
            throw new Error(`WHO PQ API error: ${res.status}`);
          }

          const data = (await res.json()) as {
            results?: WhoPqProduct[];
            next?: string | null;
            count?: number;
          };

          if (!data.results || data.results.length === 0) break;

          for (const item of data.results) {
            const signalType: "WHO_PQ" = "WHO_PQ";

            signals.push({
              externalId: `who-pq-${item.whoPqId ?? item.id ?? item.productName ?? "unknown"}`,
              source: "who",
              jurisdiction: "WHO",
              type: signalType,
              title: `WHO PQ — ${item.productName ?? "Unknown product"}`,
              description: `WHO prequalified product: ${item.productName ?? "Unknown"} by ${item.manufacturer ?? "Unknown manufacturer"} (${item.manufacturerCountry ?? "Unknown country"}). Category: ${item.productCategory ?? "N/A"}. Status: ${item.status ?? "Active"}.`,
              date: item.prequalificationDate ?? "",
              url: item.website ?? `${PQ_PORTAL}product/${item.whoPqId ?? item.id}`,
              companyName: item.manufacturer,
              productName: item.productName,
              productCode: item.productCode ?? item.productCategory,
              metadata: {
                whoPqId: item.whoPqId,
                productCategory: item.productCategory,
                productSubcategory: item.productSubcategory,
                manufacturerCountry: item.manufacturerCountry,
                status: item.status,
                description: item.description,
              },
            });
          }

          page++;
          hasMore = !!data.next;
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch {
        // API endpoint unavailable — try next
        continue;
      }
    }

    if (signals.length > 0) return signals;

    // Attempt 2: Fetch the WHO PQ public CSV export
    try {
      const csvUrl = `${PQ_API_BASE}/prequalified-products/export?format=csv`;
      const res = await fetch(csvUrl, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const text = await res.text();
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length > 1) {
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
          const nameIdx = headers.findIndex((h) => h.includes("product") || h.includes("name"));
          const companyIdx = headers.findIndex((h) => h.includes("manufacturer") || h.includes("company"));
          const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("pq") || h.includes("prequalif"));
          const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("type"));

          for (let i = 1; i < Math.min(lines.length, config.maxSignalsPerSource + 1); i++) {
            const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
            const productName = nameIdx >= 0 ? cols[nameIdx] : undefined;
            if (!productName) continue;

            signals.push({
              externalId: `who-pq-csv-${productName.replace(/\s+/g, "-").toLowerCase()}`,
              source: "who",
              jurisdiction: "WHO",
              type: "WHO_PQ",
              title: `WHO PQ — ${productName}`,
              description: `WHO prequalified product: ${productName} by ${companyIdx >= 0 ? cols[companyIdx] : "Unknown"}.`,
              date: dateIdx >= 0 ? cols[dateIdx] : "",
              url: PQ_PORTAL,
              companyName: companyIdx >= 0 ? cols[companyIdx] : undefined,
              productName,
              productCode: catIdx >= 0 ? cols[catIdx] : undefined,
            });
          }
        }
      }
    } catch {
      // CSV export unavailable
    }

    // Attempt 3: Fetch the PQ portal homepage for HTML-embedded data
    if (signals.length === 0) {
      try {
        const res = await fetch(PQ_PORTAL, {
          headers: { "User-Agent": config.userAgent },
          signal: AbortSignal.timeout(15_000),
        });

        if (res.ok) {
          const html = await res.text();

          // Look for JSON-LD structured data
          const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
          if (jsonLdMatch) {
            const structured = JSON.parse(jsonLdMatch[1]) as
              | { name?: string; description?: string; dateModified?: string }
              | Array<{ name?: string; description?: string; dateModified?: string }>;
            const items = Array.isArray(structured) ? structured : [structured];

            for (const item of items) {
              if (item.name && !item.name.includes("WHO")) {
                signals.push({
                  externalId: `who-pq-ld-${item.name.replace(/\s+/g, "-").toLowerCase()}`,
                  source: "who",
                  jurisdiction: "WHO",
                  type: "WHO_PQ",
                  title: `WHO PQ — ${item.name}`,
                  description: item.description ?? item.name,
                  date: item.dateModified ?? "",
                  url: PQ_PORTAL,
                  productName: item.name,
                });
              }
            }
          }
        }
      } catch {
        // All attempts exhausted
      }
    }

    return signals;
  }
}
