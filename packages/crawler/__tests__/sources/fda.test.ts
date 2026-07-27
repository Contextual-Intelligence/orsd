import { describe, it, expect, vi, beforeEach } from "vitest";
import { FdaSource } from "../../src/sources/fda/index.js";
import type { CrawlerConfig } from "../../src/config.js";

const CONFIG: CrawlerConfig = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

/** Simulated FDA 510(k) API response page. */
const MOCK_510K_PAGE = {
  results: [
    {
      k_number: "K123456",
      applicant: "TestCorp Inc.",
      device_name: "Test Analyzer 3000",
      product_code: "ABC",
      date_received: "2026-01-15",
      decision_date: "2026-06-01",
      clearance_type: "Traditional",
      state: "CA",
    },
    {
      k_number: "K123457",
      applicant: "MedDevice Co.",
      device_name: "Quick Test Strip",
      product_code: "XYZ",
      date_received: "2026-02-20",
      decision_date: "2026-07-10",
      clearance_type: "Special",
      state: "MA",
    },
  ],
  meta: { results: { total: 2, skip: 0, limit: 100 } },
};

/** Simulated FDA PMA API response page. */
const MOCK_PMA_PAGE = {
  results: [
    {
      pma_number: "P000001",
      applicant: "Surgical Innovations",
      device_name: "Precision Scalpel System",
      product_code: "DEF",
      date_received: "2025-11-01",
      decision_date: "2026-05-15",
      supptype: "Original",
    },
  ],
  meta: { results: { total: 1, skip: 0, limit: 100 } },
};

/** Simulated FDA De Novo API response page. */
const MOCK_DENOVO_PAGE = {
  results: [
    {
      denovo_number: "DEN200001",
      applicant: "NovoDiagnostics",
      device_name: "Novel Biomarker Assay",
      product_code: "GHI",
      decision_date: "2026-03-20",
      classification: "Class II",
      device_class: "2",
    },
  ],
  meta: { results: { total: 1, skip: 0, limit: 100 } },
};

/** Simulated FDA CLIA API response page. */
const MOCK_CLIA_PAGE = {
  results: [
    {
      clia_id: "CLIA-001",
      applicant: "LabCorp Clinical",
      device_name: "Rapid Test System",
      product_code: "JKL",
      decision_date: "2026-04-10",
      waiver: "Waived",
    },
  ],
  meta: { results: { total: 1, skip: 0, limit: 100 } },
};

describe("FdaSource", () => {
  let source: FdaSource;

  beforeEach(() => {
    source = new FdaSource();
    global.fetch = vi.fn();
  });

  it("should return expected metadata", () => {
    expect(source.name).toBe("fda");
    expect(source.jurisdiction).toBe("US");
  });

  it("should aggregate all FDA endpoints into signals", async () => {
    // Return different data for each API endpoint URL
    vi.mocked(fetch).mockImplementation(async (url: RequestInfo) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("510k")) {
        return new Response(JSON.stringify(MOCK_510K_PAGE), { status: 200 });
      }
      if (urlStr.includes("pma")) {
        return new Response(JSON.stringify(MOCK_PMA_PAGE), { status: 200 });
      }
      if (urlStr.includes("denovo")) {
        return new Response(JSON.stringify(MOCK_DENOVO_PAGE), { status: 200 });
      }
      if (urlStr.includes("clia")) {
        return new Response(JSON.stringify(MOCK_CLIA_PAGE), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(5); // 2 510k + 1 PMA + 1 DeNovo + 1 CLIA

    // Check 510(k) signal shape
    const clearance = signals.find((s) => s.externalId === "fda-510k-K123456");
    expect(clearance).toBeDefined();
    expect(clearance!.type).toBe("FDA_510K");
    expect(clearance!.jurisdiction).toBe("US");
    expect(clearance!.companyName).toBe("TestCorp Inc.");
    expect(clearance!.productName).toBe("Test Analyzer 3000");
    expect(clearance!.productCode).toBe("ABC");
    expect(clearance!.date).toBe("2026-06-01");
    expect(clearance!.url).toContain("K123456");

    // Check PMA signal shape
    const pma = signals.find((s) => s.externalId === "fda-pma-P000001");
    expect(pma).toBeDefined();
    expect(pma!.type).toBe("FDA_PMA");
    expect(pma!.companyName).toBe("Surgical Innovations");

    // Check De Novo signal shape
    const denovo = signals.find((s) => s.externalId === "fda-denovo-DEN200001");
    expect(denovo).toBeDefined();
    expect(denovo!.type).toBe("FDA_DE_NOVO");

    // Check CLIA signal shape
    const clia = signals.find((s) => s.externalId === "fda-clia-CLIA-001");
    expect(clia).toBeDefined();
    expect(clia!.type).toBe("FDA_CLIA_WAIVER");
  });

  it("should handle partial API failures gracefully", async () => {
    // 510(k) works, PMA fails, De Novo works, CLIA fails
    vi.mocked(fetch).mockImplementation(async (url: RequestInfo) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("510k")) {
        return new Response(JSON.stringify(MOCK_510K_PAGE), { status: 200 });
      }
      return new Response("Error", { status: 500 });
    });

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2); // only 510(k) worked
  });

  it("should handle all APIs failing", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });
});
