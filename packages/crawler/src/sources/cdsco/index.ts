/**
 * CDSCO Source Connector
 *
 * India Central Drugs Standard Control Organization — medical device
 * registrations and import licenses.
 *
 * CDSCO publishes registered medical device data through:
 *   - Public portal: https://cdscoonline.gov.in/CDSCO/device-registration
 *   - CDSCO website: https://cdsco.gov.in
 *
 * Note: CDSCO does not currently provide a documented public REST API.
 * The data is accessible through web search interfaces. Future versions
 * may leverage the Indian Government's Open Data portal (data.gov.in).
 *
 * Data.gov.in medical device datasets:
 *   https://data.gov.in/catalog/medical-devices-registered-cdsco
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const CDSCO_PORTAL = "https://cdscoonline.gov.in/CDSCO/device-registration";
const DATA_GOV_IN_API = "https://api.data.gov.in/resource";

/**
 * Known CDSCO dataset ID on data.gov.in for medical device registrations.
 * This may need periodic updating as the government updates catalog IDs.
 */
const DEVICE_REGISTRATION_DATASET = "abc123-def456"; // placeholder — update when confirmed

export class CdscoSource implements SourceConnector {
  name = "cdsco";
  jurisdiction = "IN" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Attempt 1: Try the data.gov.in Open API
    try {
      const params = new URLSearchParams({
        "api-key": process.env.DATA_GOV_IN_API_KEY ?? "demo",
        format: "json",
        limit: "100",
        offset: "0",
      });
      const url = `${DATA_GOV_IN_API}/${DEVICE_REGISTRATION_DATASET}?${params}`;
      const res = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          records?: Array<{
            registration_number?: string;
            device_name?: string;
            manufacturer_name?: string;
            registration_date?: string;
            valid_upto?: string;
            risk_class?: string;
          }>;
          total?: number;
        };

        if (data.records) {
          for (const item of data.records) {
            signals.push({
              externalId: `cdsco-${item.registration_number ?? item.device_name ?? "unknown"}`,
              source: "cdsco",
              jurisdiction: "IN",
              type: "CDSCO_REGISTRATION",
              title: `CDSCO Registration — ${item.device_name ?? "Unknown device"}`,
              description: `CDSCO registration ${item.registration_number ?? "N/A"}: ${item.device_name ?? "Unknown device"} by ${item.manufacturer_name ?? "Unknown manufacturer"}. Risk class: ${item.risk_class ?? "N/A"}. Valid until: ${item.valid_upto ?? "N/A"}.`,
              date: item.registration_date ?? "",
              url: `${CDSCO_PORTAL}?search=${encodeURIComponent(item.registration_number ?? "")}`,
              companyName: item.manufacturer_name,
              productName: item.device_name,
              productCode: item.registration_number,
              metadata: {
                registrationNumber: item.registration_number,
                validUpto: item.valid_upto,
                riskClass: item.risk_class,
              },
            });
          }
        }
      }
    } catch {
      // data.gov.in unavailable
    }

    if (signals.length > 0) return signals;

    // Attempt 2: Fetch the CDSCO portal HTML and extract meta info
    try {
      const res = await fetch(CDSCO_PORTAL, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const html = await res.text();

        // Look for JSON-embedded data in script tags (common in modern portals)
        const jsonMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({.+?})<\/script>/);
        if (jsonMatch) {
          const state = JSON.parse(jsonMatch[1]) as {
            devices?: Array<{
              regNo?: string;
              deviceName?: string;
              manufacturer?: string;
              regDate?: string;
            }>;
          };
          if (state.devices) {
            for (const device of state.devices) {
              signals.push({
                externalId: `cdsco-portal-${device.regNo ?? device.deviceName ?? "unknown"}`,
                source: "cdsco",
                jurisdiction: "IN",
                type: "CDSCO_REGISTRATION",
                title: `CDSCO Registration — ${device.deviceName ?? "Unknown"}`,
                description: `Device: ${device.deviceName ?? "Unknown"}. Registration: ${device.regNo ?? "N/A"}. Manufacturer: ${device.manufacturer ?? "N/A"}.`,
                date: device.regDate ?? "",
                url: CDSCO_PORTAL,
                companyName: device.manufacturer,
                productName: device.deviceName,
                productCode: device.regNo,
              });
            }
          }
        }
      }
    } catch {
      // Both attempts failed
    }

    return signals;
  }
}
