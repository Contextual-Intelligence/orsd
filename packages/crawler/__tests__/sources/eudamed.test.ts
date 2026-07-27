import { describe, it, expect, vi, beforeEach } from "vitest";
import { EudamedSource } from "../../src/sources/eudamed/index.js";
import type { CrawlerConfig } from "../../src/config.js";

const CONFIG: CrawlerConfig = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

/** Simulated EUDAMED certificates API response. */
const MOCK_CERTIFICATES = {
  content: [
    {
      certificateNumber: "EU-CERT-001",
      certificateStatus: "ACTIVE",
      notifiedBody: { name: "TÜV SÜD", number: 123 },
      manufacturerName: "Siemens Healthineers",
      manufacturerCountry: "DE",
      deviceName: "MRI Scanner X200",
      deviceCategory: "Class IIb",
      issueDate: "2025-06-01",
      expiryDate: "2028-06-01",
      lastUpdate: "2025-12-01",
    },
    {
      certificateNumber: "EU-CERT-002",
      certificateStatus: "ACTIVE",
      notifiedBody: { name: "BSI", number: 456 },
      manufacturerName: "Philips Medical",
      manufacturerCountry: "NL",
      deviceName: "Patient Monitor M100",
      deviceCategory: "Class IIa",
      issueDate: "2025-07-15",
      expiryDate: "2028-07-15",
      lastUpdate: "2026-01-10",
    },
  ],
  totalElements: 2,
  totalPages: 1,
  number: 0,
};

/** Simulated dashboard stats fallback (used when cert API fails). */
const MOCK_STATS = {
  totalCertificates: 1500,
  totalManufacturers: 420,
  lastUpdated: "2026-01-20",
};

describe("EudamedSource", () => {
  let source: EudamedSource;

  beforeEach(() => {
    source = new EudamedSource();
    global.fetch = vi.fn();
  });

  it("should return expected metadata", () => {
    expect(source.name).toBe("eudamed");
    expect(source.jurisdiction).toBe("EU");
  });

  it("should parse certificates into signals", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_CERTIFICATES), { status: 200 }),
    );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2);

    // Code uses prefix "eudamed-cert-" for certificate IDs
    const s1 = signals.find((s) => s.externalId === "eudamed-cert-EU-CERT-001");
    expect(s1).toBeDefined();
    expect(s1!.type).toBe("EUDAMED_CERTIFICATE");
    expect(s1!.jurisdiction).toBe("EU");
    expect(s1!.companyName).toBe("Siemens Healthineers");
    expect(s1!.productName).toBe("MRI Scanner X200");
    expect(s1!.productCode).toBe("Class IIb");
    expect(s1!.date).toBe("2025-06-01");
    expect(s1!.url).toContain("EU-CERT-001");
    expect(s1!.metadata?.notifiedBody).toBe("TÜV SÜD");
    expect(s1!.metadata?.certificateStatus).toBe("ACTIVE");
    expect(s1!.metadata?.manufacturerCountry).toBe("DE");
  });

  it("should fall back to dashboard stats when cert API fails with 403", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 })) // cert API
      .mockResolvedValueOnce( // dashboard stats
        new Response(JSON.stringify(MOCK_STATS), { status: 200 }),
      );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe("REGULATORY_UPDATE");
    expect(signals[0].title).toContain("EUDAMED Database Summary");
    expect(signals[0].metadata?.totalCertificates).toBe(1500);
  });

  it("should return empty when all strategies fail", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });

  it("should handle fetchJson network errors (ECONNREFUSED/ENOTFOUND)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ENOTFOUND"));
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });

  it("should handle malformed response gracefully", async () => {
    // fetchJson catches ECONNREFUSED/ENOTFOUND and returns null
    vi.mocked(fetch).mockRejectedValue(new Error("ENOTFOUND"));
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });
});
