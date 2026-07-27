/**
 * TGA Source Connector
 *
 * Australian Therapeutic Goods Administration — medical device registrations
 * from the Australian Register of Therapeutic Goods (ARTG).
 *
 * Data sources:
 *   - ARTG public data: https://www.tga.gov.au/artg-public-data
 *   - Data.gov.au: https://data.gov.au/dataset/artg
 *   - TGA API: https://api.tga.gov.au
 *
 * The ARTG dataset includes medical devices, biologicals, and other
 * therapeutic goods registered for supply in Australia.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const ARTG_API_BASE = "https://api.tga.gov.au/v1";
const DATA_GOV_AU_DATASET = "https://data.gov.au/data/api/3/action/datastore_search";

/**
 * ARTG record category identifiers for medical devices.
 */
const MEDICAL_DEVICE_CATEGORIES = ["I", "IIa", "IIb", "III", "AIMD", "Class 1", "Class 2a", "Class 2b", "Class 3"];

interface ArtgRecord {
  artg_number?: string;
  product_name?: string;
  sponsor?: string;
  manufacturer?: string;
  category?: string;
  classification?: string;
  gmdn_code?: string;
  gmdn_term?: string;
  date_of_effect?: string;
  expiry_date?: string;
  status?: string;
}

export class TgaSource implements SourceConnector {
  name = "tga";
  jurisdiction = "AU" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Attempt 1: TGA public API
    try {
      const params = new URLSearchParams({
        resource_id: "artg-medical-devices",
        limit: "100",
      });
      const url = `${DATA_GOV_AU_DATASET}?${params}`;
      const res = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(20_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          result?: {
            records?: ArtgRecord[];
            total?: number;
          };
        };

        if (data.result?.records) {
          for (const item of data.result.records) {
            if (!this.isMedicalDevice(item)) continue;

            signals.push({
              externalId: `tga-${item.artg_number ?? item.product_name ?? "unknown"}`,
              source: "tga",
              jurisdiction: "AU",
              type: "TGA_REGISTRATION",
              title: `TGA Registration — ${item.product_name ?? "Unknown product"}`,
              description: `ARTG ${item.artg_number ?? "N/A"}: ${item.product_name ?? "Unknown product"} by ${item.sponsor ?? item.manufacturer ?? "Unknown sponsor"}. Classification: ${item.classification ?? item.category ?? "N/A"}. Status: ${item.status ?? "N/A"}.`,
              date: item.date_of_effect ?? "",
              url: `https://www.tga.gov.au/resources/artg/${item.artg_number}`,
              companyName: item.sponsor ?? item.manufacturer,
              productName: item.product_name,
              productCode: item.gmdn_code,
              metadata: {
                artgNumber: item.artg_number,
                classification: item.classification,
                gmdnTerm: item.gmdn_term,
                expiryDate: item.expiry_date,
                status: item.status,
                manufacturer: item.manufacturer,
              },
            });
          }
        }
      }
    } catch {
      // data.gov.au unavailable
    }

    if (signals.length > 0) return signals;

    // Attempt 2: Direct TGA API
    try {
      const url = `${ARTG_API_BASE}/products?type=medical-device&limit=100`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": config.userAgent,
          "Accept": "application/json",
          // TGA API may require an API key
          "X-API-Key": process.env.TGA_API_KEY ?? "",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          products?: Array<{
            artgId?: string;
            name?: string;
            sponsorName?: string;
            classification?: string;
            effectiveDate?: string;
          }>;
        };

        if (data.products) {
          for (const item of data.products) {
            signals.push({
              externalId: `tga-api-${item.artgId ?? item.name ?? "unknown"}`,
              source: "tga",
              jurisdiction: "AU",
              type: "TGA_REGISTRATION",
              title: `TGA — ${item.name ?? "Unknown product"}`,
              description: `ARTG ${item.artgId ?? "N/A"}: ${item.name ?? "Unknown"} by ${item.sponsorName ?? "Unknown"}.`,
              date: item.effectiveDate ?? "",
              url: `https://www.tga.gov.au/resources/artg/${item.artgId}`,
              companyName: item.sponsorName,
              productName: item.name,
              productCode: item.classification,
            });
          }
        }
      }
    } catch {
      // TGA API unavailable
    }

    return signals;
  }

  private isMedicalDevice(record: ArtgRecord): boolean {
    const cat = (record.category ?? "").toLowerCase();
    const cls = (record.classification ?? "").toLowerCase();
    const name = (record.product_name ?? "").toLowerCase();
    return (
      MEDICAL_DEVICE_CATEGORIES.some((c) => cat.includes(c.toLowerCase())) ||
      MEDICAL_DEVICE_CATEGORIES.some((c) => cls.includes(c.toLowerCase())) ||
      name.includes("device") ||
      name.includes("diagnostic") ||
      name.includes("implant") ||
      name.includes("instrument")
    );
  }
}
