import { describe, it, expect } from "vitest";
import { enrichSignals } from "../../src/etl/enrich.js";
import type { NormalizedSignal } from "../../src/types.js";

function makeSignal(overrides: Partial<NormalizedSignal> = {}): NormalizedSignal {
  return {
    id: "test-id",
    externalId: "test-001",
    source: "fda",
    jurisdiction: "US",
    type: "FDA_510K",
    title: "Test Device",
    description: "A test medical device clearance.",
    date: "2026-06-15",
    url: "https://example.com/device",
    confidence: "medium",
    metadata: {},
    ingestedAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("enrichSignals", () => {
  it("should normalize company names (strip legal suffixes)", async () => {
    const [result] = await enrichSignals([
      makeSignal({ companyName: "TestCorp Inc." }),
    ]);
    expect(result.companyName).toBe("testcorp");
    expect(result.metadata._originalName).toBe("TestCorp Inc.");
    expect(result.metadata._normalizedName).toBe("testcorp");
  });

  it("should normalize complex company names", async () => {
    const [result] = await enrichSignals([
      makeSignal({ companyName: "Boston Scientific Corporation" }),
    ]);
    expect(result.companyName).toBe("boston scientific");
    expect(result.metadata._normalizedName).toBe("boston scientific");
  });

  it("should handle international suffixes", async () => {
    const cases = [
      { input: "Siemens Healthineers GmbH", expected: "siemens healthineers" },
      { input: "Philips Medical Systems B.V.", expected: "philips medical systems" },
      { input: "Roche Diagnostics AG", expected: "roche diagnostics" },
      { input: " Toshiba Medical Systems Corp ", expected: "toshiba medical systems" },
    ];
    for (const { input, expected } of cases) {
      const [result] = await enrichSignals([makeSignal({ companyName: input })]);
      expect(result.companyName).toBe(expected);
    }
  });

  it("should preserve company names without suffixes", async () => {
    const [result] = await enrichSignals([
      makeSignal({ companyName: "Medtronic" }),
    ]);
    expect(result.companyName).toBe("medtronic");
  });

  it("should leave undefined company names unchanged", async () => {
    const [result] = await enrichSignals([makeSignal({ companyName: undefined })]);
    expect(result.companyName).toBeUndefined();
  });

  it("should build fallback description for short descriptions", async () => {
    const [result] = await enrichSignals([
      makeSignal({
        description: "Short",
        companyName: "Acme Corp",
        productName: "Heart Pump",
        productCode: "XYZ-123",
      }),
    ]);
    expect(result.description).toContain("acme");
    // typeLabel from FDA_510K → "FDA 510K" (capitalized per word boundary)
    expect(result.description).toContain("510K");
    expect(result.description).toContain("Heart Pump");
    expect(result.description).toContain("XYZ-123");
    expect(result.description).toContain("US");
  });

  it("should leave good descriptions unchanged", async () => {
    const desc = "A longer description that is definitely more than ten characters long.";
    const [result] = await enrichSignals([makeSignal({ description: desc })]);
    expect(result.description).toBe(desc);
  });

  it("should handle empty input", async () => {
    const result = await enrichSignals([]);
    expect(result).toEqual([]);
  });
});
