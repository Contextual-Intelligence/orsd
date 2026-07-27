/**
 * EUDAMED Source Connector
 *
 * European Database on Medical Devices — fetches public certificates,
 * notified body opinions, and clinical investigation records.
 *
 * EUDAMED is being rolled out in phases. The API below connects to
 * the public EUDAMED API endpoints published by the European Commission.
 * Some modules (e.g., Clinical Investigations) may require authentication.
 *
 * API docs: https://ec.europa.eu/tools/eudamed/api
 * Public portal: https://ec.europa.eu/tools/eudamed
 *
 * Note: EUDAMED API access is gradually expanding. If the API returns 403/401,
 * the connector degrades gracefully to an empty result set.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const BASE_URL = "https://ec.europa.eu/tools/eudamed/api";
const PUBLIC_API_BASE = "https://ec.europa.eu/tools/eudamed/api/certificates/v1";

interface EudamedCertificate {
  certificateNumber?: string;
  certificateStatus?: string;
  notifiedBody?: { name?: string; number?: number };
  manufacturerName?: string;
  manufacturerCountry?: string;
  deviceName?: string;
  deviceCategory?: string;
  issueDate?: string;
  expiryDate?: string;
  lastUpdate?: string;
}

interface EudamedApiResponse {
  content?: EudamedCertificate[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  error?: string;
}

async function fetchJson<T>(url: string, config: CrawlerConfig): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) return null; // access restricted
      throw new Error(`EUDAMED API error: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) return null;
    throw err;
  }
}

export class EudamedSource implements SourceConnector {
  name = "eudamed";
  jurisdiction = "EU" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Try the public certificates API
    const certUrl = `${PUBLIC_API_BASE}/certificates/search?page=0&size=100&sort=issueDate,desc`;
    const certData = await fetchJson<EudamedApiResponse>(certUrl, config);

    if (certData?.content) {
      for (const cert of certData.content) {
        signals.push({
          externalId: `eudamed-cert-${cert.certificateNumber ?? "unknown"}`,
          source: "eudamed",
          jurisdiction: "EU",
          type: "EUDAMED_CERTIFICATE",
          title: `EUDAMED Certificate — ${cert.deviceName ?? cert.manufacturerName ?? "Unknown device"}`,
          description: `Certificate ${cert.certificateNumber ?? "N/A"}: ${cert.deviceName ?? "Unknown device"} by ${cert.manufacturerName ?? "Unknown manufacturer"}. Status: ${cert.certificateStatus ?? "Unknown"}. NB: ${cert.notifiedBody?.name ?? "Unknown"}.`,
          date: cert.issueDate ?? cert.lastUpdate ?? "",
          url: `https://ec.europa.eu/tools/eudamed/#/screen/certificates/${cert.certificateNumber}`,
          companyName: cert.manufacturerName,
          productName: cert.deviceName,
          productCode: cert.deviceCategory,
          metadata: {
            certificateNumber: cert.certificateNumber,
            certificateStatus: cert.certificateStatus,
            notifiedBody: cert.notifiedBody?.name,
            notifiedBodyNumber: cert.notifiedBody?.number,
            expiryDate: cert.expiryDate,
            manufacturerCountry: cert.manufacturerCountry,
          },
        });
      }
    } else {
      // Fallback: scrape the public dashboard summary page
      const dashboardSignals = await this.fetchDashboardFallback(config);
      signals.push(...dashboardSignals);
    }

    return signals;
  }

  private async fetchDashboardFallback(config: CrawlerConfig): Promise<RawSignal[]> {
    // EUDAMED publishes some summary statistics on their public dashboard.
    // This fallback attempts to fetch the public HTML page and extract
    // any structured data embedded in it.
    try {
      const url = "https://ec.europa.eu/tools/eudamed/api/statistics/v1/summary";
      const data = await fetchJson<{ totalCertificates?: number; totalManufacturers?: number; lastUpdated?: string }>(url, config);
      if (data) {
        return [{
          externalId: `eudamed-stats-${data.lastUpdated ?? "unknown"}`,
          source: "eudamed",
          jurisdiction: "EU",
          type: "REGULATORY_UPDATE",
          title: "EUDAMED Database Summary",
          description: `EUDAMED contains ${data.totalCertificates ?? "unknown"} certificates from ${data.totalManufacturers ?? "unknown"} manufacturers. Last updated: ${data.lastUpdated ?? "unknown"}.`,
          date: data.lastUpdated ?? "",
          url: "https://ec.europa.eu/tools/eudamed",
          metadata: { totalCertificates: data.totalCertificates, totalManufacturers: data.totalManufacturers },
        }];
      }
    } catch {
      // Silently fall through
    }
    return [];
  }
}
