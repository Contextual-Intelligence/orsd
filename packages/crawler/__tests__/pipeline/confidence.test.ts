import { describe, it, expect } from "vitest";
import { scoreConfidence } from "../../src/pipeline/confidence.js";
import type { NormalizedSignal } from "../../src/types.js";

function makeSignal(overrides: Partial<NormalizedSignal> = {}): NormalizedSignal {
  return {
    id: "test-id",
    externalId: "test-001",
    source: "fda",
    jurisdiction: "US",
    type: "FDA_510K",
    title: "Test Device",
    description: "",
    date: "2026-06-15",
    url: "",
    confidence: "medium",
    metadata: {},
    ingestedAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("scoreConfidence", () => {
  it("should assign 'high' for reliable source with complete fields", () => {
    const signals = [
      makeSignal({
        source: "fda",
        companyName: "TestCorp",
        productCode: "ABC",
        description: "A".repeat(60),
        url: "https://example.com",
        metadata: { someKey: "value" },
      }),
    ];
    const [result] = scoreConfidence(signals);
    expect(result.confidence).toBe("high");
  });

  it("should assign 'high' for reliable source with minimal fields (source alone >= threshold)", () => {
    // FDA reliability (0.95) alone pushes it over 0.8
    const signals = [makeSignal({ source: "fda" })];
    const [result] = scoreConfidence(signals);
    expect(result.confidence).toBe("high");
  });

  it("should assign 'medium' for moderately reliable source with no bonuses", () => {
    // cdcos reliability (0.70) + no bonuses = 0.70 → medium
    const signals = [makeSignal({ source: "cdsco" })];
    const [result] = scoreConfidence(signals);
    expect(result.confidence).toBe("medium");
  });

  it("should assign 'low' for unknown source with no bonuses", () => {
    // unknown source (0.3) + no bonuses = 0.3 → low
    const signals = [
      makeSignal({
        source: "unknown",
        description: "",
        url: "",
      }),
    ];
    const [result] = scoreConfidence(signals);
    expect(result.confidence).toBe("low");
  });

  it("should assign 'medium' for moderately reliable source", () => {
    // nmpa (0.70) + no bonuses = 0.70 → medium
    const signals = [makeSignal({ source: "nmpa" })];
    const [result] = scoreConfidence(signals);
    expect(result.confidence).toBe("medium");
  });

  it("should handle empty input", () => {
    const result = scoreConfidence([]);
    expect(result).toEqual([]);
  });

  it("should not modify fields other than confidence", () => {
    const signal = makeSignal({ source: "fda", title: "Keep Me" });
    const [result] = scoreConfidence([signal]);
    expect(result.title).toBe("Keep Me");
    expect(result.id).toBe(signal.id);
    expect(result.source).toBe("fda");
  });

  it("should give bonus for company name", () => {
    const without = scoreConfidence([makeSignal({ source: "eudamed" })])[0];
    const withCompany = scoreConfidence([makeSignal({ source: "eudamed", companyName: "Acme" })])[0];
    expect(confidenceRank(withCompany.confidence)).toBeGreaterThanOrEqual(
      confidenceRank(without.confidence),
    );
  });
});

function confidenceRank(c: string): number {
  return c === "high" ? 2 : c === "medium" ? 1 : 0;
}
