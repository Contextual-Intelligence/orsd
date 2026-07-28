/**
 * NMPA Source Connector
 *
 * China National Medical Products Administration (国家药品监督管理局) —
 * medical device approvals and registrations.
 *
 * Data is primarily available through:
 *   - NMPA database: https://www.nmpa.gov.cn/datasearch/
 *   - National Medical Products Catalog: https://www.nmpa.gov.cn/zwfw/zwfw/
 *
 * Note: NMPA does not provide a documented English-language public API.
 * The Chinese government publishes data through the National Medical
 * Products Association (NMPA) portal which requires Chinese language
 * interface. This connector attempts to access known data endpoints.
 *
 * Some public data is available through third-party aggregators and
 * Chinese government open data initiatives, but there is no reliable
 * programmatic access without language-specific handling.
 *
 * Data.gov.cn (Chinese open data): https://data.gov.cn
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const NMPA_SEARCH_URL = "https://www.nmpa.gov.cn/datasearch/search";
const DATA_GOV_CN_API = "https://api.data.gov.cn/data";

export class NmpaSource implements SourceConnector {
  name = "nmpa";
  jurisdiction = "CN" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Attempt 1: Try the Chinese Government Open Data API
    try {
      const params = new URLSearchParams({
        dataset: "medical-device-registrations",
        page: "1",
        size: "100",
      });
      const url = `${DATA_GOV_CN_API}?${params}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": config.userAgent,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{
            id?: string;
            productName?: string;
            companyName?: string;
            registrationNumber?: string;
            approvalDate?: string;
            expiryDate?: string;
            category?: string;
          }>;
          total?: number;
        };

        if (data.data) {
          for (const item of data.data) {
            signals.push({
              externalId: `nmpa-${item.registrationNumber ?? item.id ?? item.productName ?? "unknown"}`,
              source: "nmpa",
              jurisdiction: "CN",
              type: "NMPA_APPROVAL",
              title: `NMPA Approval — ${item.productName ?? "Unknown product"}`,
              description: `NMPA approval ${item.registrationNumber ?? "N/A"}: ${item.productName ?? "Unknown product"} by ${item.companyName ?? "Unknown manufacturer"}.`,
              date: item.approvalDate ?? "",
              url: `https://www.nmpa.gov.cn/datasearch/search?name=${encodeURIComponent(item.productName ?? "")}`,
              companyName: item.companyName,
              productName: item.productName,
              productCode: item.registrationNumber,
              metadata: {
                registrationNumber: item.registrationNumber,
                expiryDate: item.expiryDate,
                category: item.category,
              },
            });
          }
        }
      }
    } catch {
      // Open data API unavailable
    }

    if (signals.length > 0) return signals;

    // Attempt 2: Try the NMPA search page for embedded data
    try {
      const res = await fetch(NMPA_SEARCH_URL, {
        headers: {
          "User-Agent": config.userAgent,
          "Accept": "text/html,application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const text = await res.text();

        // Look for JSON embedded in the page.
        // Use a non-greedy approach: find var assignment, then try to balance brackets.
        const jsonStart = text.match(/var\s+deviceData\s*=\s*(\[)/);
        if (jsonStart) {
          const startIdx = text.indexOf(jsonStart[1], jsonStart.index!);
          let depth = 0;
          let endIdx = startIdx;
          for (; endIdx < text.length; endIdx++) {
            if (text[endIdx] === "[") depth++;
            else if (text[endIdx] === "]") {
              depth--;
              if (depth === 0) break;
            }
          }
          const jsonStr = text.slice(startIdx, endIdx + 1);
          try {
            const devices = JSON.parse(jsonStr) as Array<{
            id?: string;
            name?: string;
            company?: string;
            regNo?: string;
            date?: string;
          }>;
          for (const device of devices) {
            signals.push({
              externalId: `nmpa-embedded-${device.id ?? device.regNo ?? "unknown"}`,
              source: "nmpa",
              jurisdiction: "CN",
              type: "NMPA_APPROVAL",
              title: `NMPA — ${device.name ?? "Unknown device"}`,
              description: `Device: ${device.name ?? "Unknown"}. Registration: ${device.regNo ?? "N/A"}. Company: ${device.company ?? "N/A"}.`,
              date: device.date ?? "",
              url: NMPA_SEARCH_URL,
              companyName: device.company,
              productName: device.name,
              productCode: device.regNo,
            });
          }
          } catch {
            // JSON parse failed — embedded data may be malformed
          }
        }
      }
    } catch {
      // Silent fallthrough
    }

    return signals;
  }
}
