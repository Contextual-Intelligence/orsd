import { describe, it, expect, vi, beforeEach } from "vitest";
import { PmdaSource } from "../../src/sources/pmda/index.js";
import type { CrawlerConfig } from "../../src/config.js";

const CONFIG: CrawlerConfig = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

/** Simulated PMDA CSV export content (Japanese column headers, Shift-JIS-like). */
const MOCK_PMDA_CSV = `承認番号,販売名,一般的名称,申請者,承認日
22500BZX00001000,MRI診断装置,X-Ray System,株式会社島津製作所,令和5年4月1日
22600BZX00002000,超音波診断装置,Ultrasound System,富士フィルムメディカル,令和5年6月15日`;

/** Simulated PMDA API response (fallback when CSV unavailable). */
const MOCK_PMDA_API = [
  { id: "dev-001", name: "CT Scanner Alpha", company: "Toshiba Medical", approvalDate: "2024-03-01" },
  { id: "dev-002", name: "Patient Monitor Gamma", company: "Nihon Kohden", approvalDate: "2024-07-10" },
];

describe("PmdaSource", () => {
  let source: PmdaSource;

  beforeEach(() => {
    source = new PmdaSource();
    global.fetch = vi.fn();
  });

  it("should return expected metadata", () => {
    expect(source.name).toBe("pmda");
    expect(source.jurisdiction).toBe("JP");
  });

  it("should parse CSV export with Japanese era dates", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(MOCK_PMDA_CSV, { status: 200 }),
    );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2);

    const s1 = signals.find((s) => s.externalId?.includes("22500BZX00001000"));
    expect(s1).toBeDefined();
    expect(s1!.companyName).toBe("株式会社島津製作所");
    expect(s1!.productName).toBe("MRI診断装置");
    expect(s1!.type).toBe("PMDA_APPROVAL");
    // 令和5年 = 2019 + 5 = 2024 → 2024-04-01
    expect(s1!.date).toBe("2024-04-01");
  });

  it("should fall back to API when CSV fails", async () => {
    // CSV fails, API succeeds
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("Not found", { status: 404 })) // CSV
      .mockResolvedValueOnce( // API
        new Response(JSON.stringify(MOCK_PMDA_API), { status: 200 }),
      );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2);
    expect(signals[0].companyName).toBe("Toshiba Medical");
    expect(signals[0].productName).toBe("CT Scanner Alpha");
  });

  it("should return empty when both CSV and API fail", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("Not found", { status: 404 })) // CSV
      .mockRejectedValueOnce(new Error("API unavailable")); // API

    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });

  it("should handle network errors for CSV", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ETIMEDOUT"));
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });

  it("should handle empty CSV", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("header1,header2\n", { status: 200 }),
    );
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]); // only 1 data line (the headers don't count as data)
  });
});
