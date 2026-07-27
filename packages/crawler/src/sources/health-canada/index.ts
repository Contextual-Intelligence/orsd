/**
 * Health Canada Source Connector
 *
 * Health Canada — Medical Devices Active Licence Listing (MDALL).
 *
 * Health Canada publishes the MDALL dataset through their Open Data portal:
 *   - API: https://health-products.canada.ca/api/medical-devices/
 *   - Open Canada: https://open.canada.ca/data/en/dataset/mdall
 *   - Direct download: https://health-products.canada.ca/mdall-limh/
 *
 * The MDALL dataset includes all active medical device licences,
 * including manufacturer, device name, licence number, risk class,
 * and licence dates.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const HC_API_BASE = "https://health-products.canada.ca/api/medical-devices";
const MDALL_JSON_URL = `${HC_API_BASE}/licences/licences.json`;
const MDALL_SCHEMA_URL = `${HC_API_BASE}/licences/schema.json`;

interface HcLicence {
  licence_number?: string;
  licence_name?: string;
  company_name?: string;
  company_address?: string;
  postal_code?: string;
  risk_class?: string;
  licence_status?: string;
  original_licence_date?: string;
  licence_date?: string;
  licence_renewal_date?: string;
  manufacturer_name?: string;
  device_identifier?: string;
  device_name?: string;
  device_category?: string;
  device_subcategory?: string;
  device_status?: string;
  identifier?: string;
  name?: string;
  company?: string;
  class?: string;
  status?: string;
  originalDate?: string;
  renewalDate?: string;
}

/**
 * Maps Health Canada risk class codes to OpenFDA-style product codes.
 */
const RISK_CLASS_MAP: Record<string, string> = {
  "I": "Class I (Low Risk)",
  "II": "Class II (Medium Risk)",
  "III": "Class III (High Risk)",
  "IV": "Class IV (Highest Risk)",
};

export class HealthCanadaSource implements SourceConnector {
  name = "health_canada";
  jurisdiction = "CA" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seen = new Set<string>();

    // Attempt 1: Health Canada Open API (JSON endpoint)
    try {
      const res = await fetch(MDALL_JSON_URL, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const data = (await res.json()) as HcLicence[] | { licences?: HcLicence[] };

        let licences: HcLicence[] = [];
        if (Array.isArray(data)) {
          licences = data;
        } else if (data.licences) {
          licences = data.licences;
        }

        for (const item of licences) {
          const licenceId = item.licence_number ?? item.identifier ?? item.device_identifier;
          if (!licenceId || seen.has(licenceId)) continue;
          seen.add(licenceId);

          const deviceName = item.device_name ?? item.licence_name ?? item.name ?? "Unknown device";
          const companyName = item.company_name ?? item.manufacturer_name ?? item.company ?? "Unknown company";
          const riskClass = item.risk_class ?? item.class ?? item.device_category ?? "";
          const status = item.licence_status ?? item.status ?? item.device_status ?? "";
          const licenceDate = item.original_licence_date ?? item.licence_date ?? item.originalDate ?? "";

          signals.push({
            externalId: `hc-${licenceId}`,
            source: "health_canada",
            jurisdiction: "CA",
            type: "HEALTH_CANADA_LICENSE",
            title: `Health Canada Licence — ${deviceName}`,
            description: `MDEL ${licenceId}: ${deviceName} by ${companyName}. Risk class: ${RISK_CLASS_MAP[riskClass] ?? riskClass}. Status: ${status}.`,
            date: licenceDate,
            url: `https://health-products.canada.ca/mdall-limh/${licenceId}`,
            companyName,
            productName: deviceName,
            productCode: riskClass,
            metadata: {
              licenceNumber: licenceId,
              riskClass,
              status,
              renewalDate: item.licence_renewal_date ?? item.renewalDate,
              deviceCategory: item.device_category ?? item.device_subcategory,
              manufacturer: item.manufacturer_name,
              companyAddress: item.company_address,
            },
          });
        }
      }
    } catch {
      // API unavailable
    }

    if (signals.length > 0) return signals;

    // Attempt 2: Fetch the Open Canada dataset JSON
    try {
      const url = "https://open.canada.ca/data/api/3/action/package_show?id=mdall";
      const res = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          result?: {
            resources?: Array<{
              url?: string;
              format?: string;
              name?: string;
            }>;
          };
        };

        // Find a CSV or JSON resource
        const resource = data.result?.resources?.find(
          (r) => r.format?.toLowerCase() === "csv" || r.format?.toLowerCase() === "json",
        );

        if (resource?.url) {
          const dlRes = await fetch(resource.url, {
            headers: { "User-Agent": config.userAgent },
            signal: AbortSignal.timeout(30_000),
          });

          if (dlRes.ok) {
            const text = await dlRes.text();
            // Parse CSV
            const lines = text.split("\n").filter((l) => l.trim());
            if (lines.length > 1) {
              const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
              const licenceIdx = headers.findIndex((h) => h.includes("licence") || h.includes("number") || h.includes("id"));
              const nameIdx = headers.findIndex((h) => h.includes("device") || h.includes("product") || h.includes("name"));
              const companyIdx = headers.findIndex((h) => h.includes("company") || h.includes("manufacturer") || h.includes("sponsor"));

              for (let i = 1; i < Math.min(lines.length, config.maxSignalsPerSource + 1); i++) {
                const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
                const licNum = licenceIdx >= 0 ? cols[licenceIdx] : undefined;
                if (!licNum || seen.has(licNum)) continue;
                seen.add(licNum);

                signals.push({
                  externalId: `hc-csv-${licNum}`,
                  source: "health_canada",
                  jurisdiction: "CA",
                  type: "HEALTH_CANADA_LICENSE",
                  title: `Health Canada — ${nameIdx >= 0 ? cols[nameIdx] : "Unknown device"}`,
                  description: `MDEL ${licNum}`,
                  date: "",
                  url: `https://health-products.canada.ca/mdall-limh/`,
                  companyName: companyIdx >= 0 ? cols[companyIdx] : undefined,
                  productName: nameIdx >= 0 ? cols[nameIdx] : undefined,
                  metadata: { source: "open-canada-csv" },
                });
              }
            }
          }
        }
      }
    } catch {
      // Open Canada unavailable
    }

    return signals;
  }
}
