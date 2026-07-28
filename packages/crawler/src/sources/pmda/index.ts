/**
 * PMDA Source Connector
 *
 * Japan Pharmaceuticals and Medical Devices Agency — approvals,
 * certifications, and safety information.
 *
 * PMDA publishes public data through their website and the
 * Japanese Medical Devices Database (JMDN). The primary data
 * sources are:
 *
 *   - PMDA Medical Device Search: https://www.pmda.go.jp/PmdaSearch/deviceSearch/
 *   - JMDN (Japan Medical Device Nomenclature): https://www.jmdr.or.jp/
 *   - PMDA English portal: https://www.pmda.go.jp/english/
 *
 * Note: PMDA does not provide a documented public REST API.
 * Data is primarily accessed through HTML search interfaces.
 * This connector attempts to access known machine-readable
 * exports and falls back gracefully.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

/** URL for the PMDA medical device registration list (CSV export) */
const CSV_EXPORT_URL = "https://www.pmda.go.jp/english/devices/csv/device_list.csv";

/** URL for the PMDA device API if available */
const API_BASE = "https://www.pmda.go.jp/device-search/api/v1";

export class PmdaSource implements SourceConnector {
  name = "pmda";
  jurisdiction = "JP" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Attempt 1: Fetch the PMDA public CSV device list
    try {
      const res = await fetch(CSV_EXPORT_URL, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const text = await res.text();
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length > 1) {
          // CSV headers typically: 承認番号,販売名,一般的名称,申請者,承認日 etc.
          // (approval number, trade name, generic name, applicant, approval date)
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));
          const approvalIdx = headers.findIndex((h) => h.includes("承認") || h.includes("approval") || h.includes("番号"));
          const nameIdx = headers.findIndex((h) => h.includes("販売") || h.includes("name") || h.includes("品目"));
          const applicantIdx = headers.findIndex((h) => h.includes("申請") || h.includes("applicant") || h.includes("会社"));
          const dateIdx = headers.findIndex((h) => h.includes("承認日") || h.includes("date") || h.includes("年月日"));

          for (let i = 1; i < Math.min(lines.length, config.maxSignalsPerSource + 1); i++) {
            const cols = lines[i].split(",").map((c) => c.trim().replace(/^"/, "").replace(/"$/, ""));
            const approvalNumber = approvalIdx >= 0 ? cols[approvalIdx] : undefined;
            const deviceName = nameIdx >= 0 ? cols[nameIdx] : undefined;
            const applicant = applicantIdx >= 0 ? cols[applicantIdx] : undefined;
            const approvalDate = dateIdx >= 0 ? cols[dateIdx] : undefined;

            if (!approvalNumber && !deviceName) continue;

            signals.push({
              externalId: `pmda-${approvalNumber ?? `device-${i}`}`,
              source: "pmda",
              jurisdiction: "JP",
              type: "PMDA_APPROVAL",
              title: `PMDA Approval — ${deviceName ?? "Unknown device"}`,
              description: `PMDA approval ${approvalNumber ?? "N/A"}: ${deviceName ?? "Unknown device"} by ${applicant ?? "Unknown applicant"}.`,
              date: formatJpDate(approvalDate),
              url: `https://www.pmda.go.jp/PmdaSearch/deviceSearch/${approvalNumber ?? ""}`,
              companyName: applicant,
              productName: deviceName,
              metadata: { approvalNumber, rawHeaders: headers.join("|") },
            });
          }
        }
      }
    } catch {
      // CSV unavailable — try API
    }

    // Attempt 2: Try the PMDA device API
    if (signals.length === 0) {
      try {
        const url = `${API_BASE}/devices?limit=100`;
        const res = await fetch(url, {
          headers: { "User-Agent": config.userAgent, "Accept": "application/json" },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id?: string;
            name?: string;
            company?: string;
            approvalDate?: string;
          }>;
          for (const item of data) {
            signals.push({
              externalId: `pmda-api-${item.id ?? item.name ?? "unknown"}`,
              source: "pmda",
              jurisdiction: "JP",
              type: "PMDA_APPROVAL",
              title: `PMDA Device — ${item.name ?? "Unknown"}`,
              description: `PMDA device: ${item.name ?? "Unknown"} by ${item.company ?? "Unknown"}.`,
              date: item.approvalDate ?? "",
              url: `https://www.pmda.go.jp/english/devices/`,
              companyName: item.company,
              productName: item.name,
            });
          }
        }
      } catch {
        // Both attempts failed — return empty
      }
    }

    return signals;
  }
}

/**
 * Converts Japanese date formats (e.g. "令和5年4月1日", "2023-04-01")
 * to ISO date string.
 */
function formatJpDate(dateStr?: string): string {
  if (!dateStr) return "";
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
  // Japanese era format: 令和X年M月D日 or 平成X年M月D日
  // Full era names (令和, 平成, 昭和) to avoid false splits on individual chars.
  const eraMatch = dateStr.match(/^(令和|平成|昭和)(\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const eraYear = parseInt(eraMatch[2], 10);
    const month = eraMatch[3].padStart(2, "0");
    const day = eraMatch[4].padStart(2, "0");
    if (eraMatch[1] === "令和") {
      return `${2019 + eraYear}-${month}-${day}`;
    }
    if (eraMatch[1] === "平成") {
      return `${1989 + eraYear - 1}-${month}-${day}`;
    }
    if (eraMatch[1] === "昭和") {
      return `${1926 + eraYear - 1}-${month}-${day}`;
    }
  }
  // Plain Japanese format: YYYY年M月D日
  const jpMatch = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jpMatch) {
    return `${jpMatch[1]}-${jpMatch[2].padStart(2, "0")}-${jpMatch[3].padStart(2, "0")}`;
  }
  return dateStr;
}
