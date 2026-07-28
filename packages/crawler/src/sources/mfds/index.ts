/**
 * MFDS Source Connector
 *
 * South Korea Ministry of Food and Drug Safety (식품의약품안전처) —
 * medical device approvals and certifications.
 *
 * MFDS provides an Open API through the Korean Government's
 * public data portal (data.go.kr). The API documentation is
 * primarily in Korean.
 *
 * Data sources:
 *   - MFDS Open API: https://www.mfds.go.kr/eng/eng.do
 *   - data.go.kr: https://www.data.go.kr/en/
 *   - MFDS medical device search: https://emeddev.mfds.go.kr/
 *
 * Usage requires an API key from data.go.kr (set MFDS_API_KEY env var).
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const DATA_GO_KR_BASE = "https://api.data.go.kr/openapi/medical-devices";
const MFDS_PORTAL = "https://emeddev.mfds.go.kr";

interface MfdsDevice {
  deviceId?: string;
  deviceName?: string;
  deviceNameKr?: string;
  companyName?: string;
  companyNameKr?: string;
  approvalNumber?: string;
  classification?: string;
  approvalDate?: string;
  expiryDate?: string;
  productCode?: string;
}

export class MfdsSource implements SourceConnector {
  name = "mfds";
  jurisdiction = "KR" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    const apiKey = process.env.MFDS_API_KEY;

    // Attempt 1: data.go.kr Open API (paginated)
    if (apiKey) {
      try {
        let pageNo = 1;
        let totalCount: number | undefined;

        do {
          const params = new URLSearchParams({
            serviceKey: apiKey,
            numOfRows: "100",
            pageNo: String(pageNo),
            type: "json",
          });
          const url = `${DATA_GO_KR_BASE}?${params}`;
          const res = await fetch(url, {
            headers: { "User-Agent": config.userAgent },
            signal: AbortSignal.timeout(20_000),
          });

          if (!res.ok) break;

          const data = (await res.json()) as {
            response?: {
              body?: {
                items?: MfdsDevice[] | { item?: MfdsDevice | MfdsDevice[] };
                totalCount?: number;
                numOfRows?: number;
              };
            };
          };

          const body = data.response?.body;
          const rawItems = body?.items;
          let items: MfdsDevice[] = [];

          if (Array.isArray(rawItems)) {
            items = rawItems;
          } else if (rawItems?.item) {
            items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
          }

          if (items.length === 0) break;

          totalCount = body?.totalCount;

          for (const item of items) {
            signals.push({
              externalId: `mfds-${item.deviceId ?? item.approvalNumber ?? item.deviceName ?? "unknown"}`,
              source: "mfds",
              jurisdiction: "KR",
              type: "MFDS_APPROVAL",
              title: `MFDS Approval — ${item.deviceName ?? item.deviceNameKr ?? "Unknown device"}`,
              description: `MFDS approval ${item.approvalNumber ?? "N/A"}: ${item.deviceName ?? item.deviceNameKr ?? "Unknown"} by ${item.companyName ?? item.companyNameKr ?? "Unknown company"}. Classification: ${item.classification ?? "N/A"}.`,
              date: item.approvalDate ?? "",
              url: `${MFDS_PORTAL}/device/${item.deviceId ?? item.approvalNumber ?? ""}`,
              companyName: item.companyName ?? item.companyNameKr,
              productName: item.deviceName ?? item.deviceNameKr,
              productCode: item.productCode ?? item.classification,
              metadata: {
                deviceId: item.deviceId,
                approvalNumber: item.approvalNumber,
                classification: item.classification,
                expiryDate: item.expiryDate,
              },
            });
          }

          pageNo++;
          await new Promise((r) => setTimeout(r, 500));
        } while (
          totalCount !== undefined &&
          (pageNo - 1) * 100 < totalCount &&
          pageNo <= 100 &&
          signals.length < config.maxSignalsPerSource
        );
      } catch {
        // API unavailable
      }
    }

    if (signals.length > 0) return signals;

    // Attempt 2: MFDS eMedDev portal API (paginated)
    try {
      let portalPage = 1;
      const seenPortal = new Set<string>();

      while (portalPage <= 50 && signals.length < config.maxSignalsPerSource) {
        const url = `${MFDS_PORTAL}/api/device/list?page=${portalPage}&size=100`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": config.userAgent,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) break;

        const data = (await res.json()) as {
          data?: Array<{
            id?: string;
            prductNm?: string;
            entrpsNm?: string;
            permitNo?: string;
            permitDate?: string;
          }>;
        };

        if (!data.data || data.data.length === 0) break;

        for (const item of data.data) {
          const dedupId = item.id ?? item.permitNo ?? item.prductNm;
          if (!dedupId || seenPortal.has(dedupId)) continue;
          seenPortal.add(dedupId);

          signals.push({
            externalId: `mfds-portal-${dedupId}`,
            source: "mfds",
            jurisdiction: "KR",
            type: "MFDS_APPROVAL",
            title: `MFDS — ${item.prductNm ?? "Unknown device"}`,
            description: `Device: ${item.prductNm ?? "Unknown"}. Permit: ${item.permitNo ?? "N/A"}. Company: ${item.entrpsNm ?? "Unknown"}.`,
            date: item.permitDate ?? "",
            url: `${MFDS_PORTAL}/device/${item.id ?? ""}`,
            companyName: item.entrpsNm,
            productName: item.prductNm,
            productCode: item.permitNo,
          });
        }

        portalPage++;
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch {
      // Portal scraping failed
    }

    // Attempt 3: If no API key and no portal data, return a useful status signal
    if (signals.length === 0 && !apiKey) {
      signals.push({
        externalId: "mfds-info-no-api-key",
        source: "mfds",
        jurisdiction: "KR",
        type: "REGULATORY_UPDATE",
        title: "MFDS Data — API Key Required",
        description: "To fetch MFDS medical device approvals, set the MFDS_API_KEY environment variable. Register at https://www.data.go.kr/en/ to obtain a key.",
        date: "",
        url: "https://www.data.go.kr/en/",
        metadata: { info: "MFDS_API_KEY required" },
      });
    }

    return signals;
  }
}
