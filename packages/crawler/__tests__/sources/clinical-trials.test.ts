import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClinicalTrialsSource } from "../../src/sources/clinical-trials/index.js";
import type { CrawlerConfig } from "../../src/config.js";

const CONFIG: CrawlerConfig = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

/** Simulated ClinicalTrials.gov v2 API response (first page). */
const MOCK_STUDIES_PAGE = {
  studies: [
    {
      protocolSection: {
        identificationModule: {
          nctId: "NCT000001",
          briefTitle: "Study of Heart Device in Patients",
          officialTitle: "A Randomized Trial of the Heart Device System",
        },
        statusModule: {
          overallStatus: "Completed",
          startDateStruct: { date: "January 1, 2024" },
          primaryCompletionDateStruct: { date: "June 15, 2025" },
        },
        sponsorCollaboratorsModule: {
          leadSponsor: { name: "Medtronic" },
        },
        conditionsModule: {
          conditions: ["Heart Failure"],
        },
        designModule: {
          phases: ["Not Applicable"],
        },
        armsInterventionsModule: {
          interventions: [{ name: "Heart Device X", type: "Device" }],
        },
      },
      hasResults: true,
    },
  ],
  nextPageToken: "abc123",
};

/** Second page (last page, no nextPageToken). */
const MOCK_STUDIES_LAST_PAGE = {
  studies: [
    {
      protocolSection: {
        identificationModule: {
          nctId: "NCT000002",
          briefTitle: "Diagnostic Accuracy of Rapid Test",
          officialTitle: "",
        },
        statusModule: {
          overallStatus: "Recruiting",
          startDateStruct: { date: "March 1, 2024" },
          primaryCompletionDateStruct: { date: "December 2025" },
        },
        sponsorCollaboratorsModule: {
          leadSponsor: { name: "Roche Diagnostics" },
        },
        conditionsModule: {
          conditions: ["Infectious Disease"],
        },
        armsInterventionsModule: {
          interventions: [{ name: "Rapid Test Kit", type: "Diagnostic" }],
        },
      },
      hasResults: false,
    },
  ],
};

describe("ClinicalTrialsSource", () => {
  let source: ClinicalTrialsSource;

  beforeEach(() => {
    source = new ClinicalTrialsSource();
    global.fetch = vi.fn();
  });

  it("should return expected metadata", () => {
    expect(source.name).toBe("clinicaltrials");
    expect(source.jurisdiction).toBe("US");
  });

  it("should paginate through studies and produce signals", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_STUDIES_PAGE), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_STUDIES_LAST_PAGE), { status: 200 }),
      );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2);

    // Check first signal
    const s1 = signals.find((s) => s.externalId === "ct-NCT000001");
    expect(s1).toBeDefined();
    expect(s1!.type).toBe("CLINICAL_TRIAL");
    expect(s1!.companyName).toBe("Medtronic");
    expect(s1!.productName).toBe("Heart Device X");
    expect(s1!.productCode).toBe("Device");
    expect(s1!.date).toBe("June 15, 2025"); // raw date from API, not parsed
    expect(s1!.url).toContain("NCT000001");
    expect(s1!.metadata?.nctId).toBe("NCT000001");
    expect(s1!.metadata?.hasResults).toBe(true);

    // Check second signal
    const s2 = signals.find((s) => s.externalId === "ct-NCT000002");
    expect(s2).toBeDefined();
    expect(s2!.companyName).toBe("Roche Diagnostics");
    expect(s2!.productName).toBe("Rapid Test Kit");
  });

  it("should include all study types (no device-only filter)", async () => {
    // The code does NOT filter by device type — all interventional studies included
    const drugStudyPage = {
      studies: [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT000003",
              briefTitle: "Drug Trial for Hypertension",
            },
            statusModule: {
              overallStatus: "Active",
              startDateStruct: { date: "2024-01-01" },
            },
            sponsorCollaboratorsModule: {
              leadSponsor: { name: "Pfizer" },
            },
            conditionsModule: {
              conditions: ["Hypertension"],
            },
            armsInterventionsModule: {
              interventions: [
                { name: "Test Drug 100mg", type: "Drug" },
              ],
            },
          },
          hasResults: false,
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(drugStudyPage), { status: 200 }),
    );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(1); // All interventional studies are included
    expect(signals[0].companyName).toBe("Pfizer");
  });

  it("should propagate API failure (caller handles it)", async () => {
    // ClinicalTrialsSource does not have a top-level try/catch;
    // the error propagates to the pipeline orchestrator which catches it.
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    await expect(source.fetch(CONFIG)).rejects.toThrow("Network error");
  });

  it("should handle empty results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ studies: [] }), { status: 200 }),
    );

    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });

  it("should handle studies with no sponsor gracefully", async () => {
    const sparseStudy = {
      studies: [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT000004",
              briefTitle: "Sparse Study",
            },
          },
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sparseStudy), { status: 200 }),
    );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(1);
    expect(signals[0].companyName).toBeUndefined();
  });
});
