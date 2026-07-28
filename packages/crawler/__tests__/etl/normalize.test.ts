import { describe, it, expect } from "vitest";
import { normalizeSignals } from "../../src/etl/normalize.js";
import type { RawSignal } from "../../src/types.js";

const validRaw: RawSignal = {
  externalId: "test-001",
  source: "test-source",
  jurisdiction: "US",
  type: "FDA_510K",
  title: "Test Device 510(k)",
  description: "A test device clearance by TestCorp.",
  date: "2026-06-15",
  url: "https://example.com/test-001",
  companyName: "TestCorp",
  productName: "Test Device",
  productCode: "ABC123",
};

describe("normalizeSignals", () => {
  it("should convert a valid RawSignal to a NormalizedSignal", () => {
    const [result] = normalizeSignals([validRaw]);
    expect(result).toBeDefined();
    expect(result.externalId).toBe("test-001");
    expect(result.source).toBe("test-source");
    expect(result.jurisdiction).toBe("US");
    expect(result.type).toBe("FDA_510K");
    expect(result.title).toBe("Test Device 510(k)");
    expect(result.description).toBe("A test device clearance by TestCorp.");
    expect(result.date).toBe("2026-06-15");
    expect(result.companyName).toBe("TestCorp");
    expect(result.productName).toBe("Test Device");
    expect(result.productCode).toBe("ABC123");
    expect(result.confidence).toBe("medium");
    expect(result.ingestedAt).toBeTruthy();
    expect(result.id).toBeTruthy();
    expect(result.id.length).toBe(64); // SHA-256 hex, full
  });

  it("should generate deterministic IDs from source + externalId", () => {
    const [a] = normalizeSignals([validRaw]);
    const [b] = normalizeSignals([{ ...validRaw, title: "Different title" }]);
    expect(a.id).toBe(b.id); // same source + externalId = same ID
  });

  it("should generate different IDs for different externalIds", () => {
    const [a] = normalizeSignals([validRaw]);
    const [b] = normalizeSignals([{ ...validRaw, externalId: "test-002" }]);
    expect(a.id).not.toBe(b.id);
  });

  it("should filter out rows missing required fields", () => {
    const results = normalizeSignals([
      validRaw,
      { ...validRaw, externalId: "" }, // missing externalId
      { ...validRaw, type: "" as any }, // missing type
      { ...validRaw, date: "" }, // missing date
    ]);
    expect(results).toHaveLength(1);
  });

  it("should fill in defaults for missing optional fields", () => {
    const minimal: RawSignal = {
      externalId: "min-001",
      source: "test",
      jurisdiction: "US",
      type: "FDA_CLEARANCE",
      title: "",
      description: "",
      date: "2026-01-01",
      url: "",
    };
    const [result] = normalizeSignals([minimal]);
    expect(result.title).toBe("FDA_CLEARANCE — US");
    expect(result.description).toBe("");
    expect(result.url).toBe("");
    expect(result.companyName).toBeUndefined();
    expect(result.metadata).toEqual({});
  });

  it("should handle empty input array", () => {
    const results = normalizeSignals([]);
    expect(results).toEqual([]);
  });

  it("should handle null-ish metadata", () => {
    const raw = { ...validRaw, metadata: undefined as any };
    const [result] = normalizeSignals([raw]);
    expect(result.metadata).toEqual({});
  });
});
