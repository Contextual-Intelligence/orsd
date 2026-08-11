import { describe, it, expect } from "vitest";
import { getAllSources, getSource } from "../../src/sources/index.js";

describe("source registry", () => {
  it("should register all 12 sources", () => {
    const sources = getAllSources();
    expect(sources).toHaveLength(12);
  });

  it("should include all expected sources", () => {
    const names = getAllSources().map((s) => s.name).sort();
    expect(names).toEqual([
      "anvisa",
      "cdsco",
      "clinicaltrials",
      "eu-legislation",
      "eudamed",
      "fda",
      "health_canada",
      "mfds",
      "nmpa",
      "pmda",
      "tga",
      "who",
    ]);
  });

  it("should cover all 10 jurisdictions", () => {
    const jurs = getAllSources().map((s) => s.jurisdiction).sort();
    expect(jurs).toEqual([
      "AU", "BR", "CA", "CN", "EU", "EU", "IN", "JP", "KR", "US", "US", "WHO",
    ]);
    // Note: FDA + ClinicalTrials are both US; EUDAMED + EU-Legislation are both EU
  });

  it("should look up a source by name", () => {
    const fda = getSource("fda");
    expect(fda).toBeDefined();
    expect(fda!.name).toBe("fda");
    expect(fda!.jurisdiction).toBe("US");
  });

  it("should return undefined for unknown source", () => {
    expect(getSource("nonexistent")).toBeUndefined();
  });

  it("each source should have a fetch method", () => {
    for (const source of getAllSources()) {
      expect(typeof source.fetch).toBe("function");
    }
  });
});
