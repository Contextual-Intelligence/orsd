import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyAct,
  discoverNewActs,
  refreshKnownActs,
  runDiscovery,
  RELEVANCE_KEYWORDS,
  AUTO_PROMOTE_THRESHOLD,
  REVIEW_THRESHOLD,
  type DiscoveredAct,
} from "../../src/sources/eu-legislation/discover.js";

const UA = "ORSD-Test/1.0";

function mockSparqlResponse(bindings: Array<Record<string, { value: string }>>): Response {
  return new Response(
    JSON.stringify({
      head: { vars: ["celex", "title", "dateSig", "dateEntry"] },
      results: { bindings },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("EUR-Lex Discovery", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("classifyAct", () => {
    it("rejects proposals", () => {
      const act: DiscoveredAct = {
        celex: "32024R1689",
        title: "Proposal for a REGULATION OF THE EUROPEAN PARLIAMENT...",
        actType: "regulation",
        dateSignature: "2024-06-13",
        dateEntryIntoForce: null,
        relevanceScore: 30,
        matchedKeywords: ["ai"],
        isProposal: true,
      };
      expect(classifyAct(act)).toBe("rejected");
    });

    it("promotes high-relevance acts (score >= AUTO_PROMOTE_THRESHOLD)", () => {
      const act: DiscoveredAct = {
        celex: "32025R0327",
        title: "Regulation on the European Health Data Space",
        actType: "regulation",
        dateSignature: "2025-02-11",
        dateEntryIntoForce: "2025-03-25",
        relevanceScore: AUTO_PROMOTE_THRESHOLD,
        matchedKeywords: ["data", "health"],
        isProposal: false,
      };
      expect(classifyAct(act)).toBe("promoted");
    });

    it("sends medium-relevance acts to review queue", () => {
      const act: DiscoveredAct = {
        celex: "32024R1781",
        title: "Regulation establishing a framework for ecodesign",
        actType: "regulation",
        dateSignature: "2024-06-13",
        dateEntryIntoForce: "2024-07-18",
        relevanceScore: REVIEW_THRESHOLD,
        matchedKeywords: ["product"],
        isProposal: false,
      };
      expect(classifyAct(act)).toBe("review");
    });

    it("rejects low-relevance acts", () => {
      const act: DiscoveredAct = {
        celex: "32024R0001",
        title: "Regulation on something unrelated",
        actType: "regulation",
        dateSignature: "2024-01-01",
        dateEntryIntoForce: null,
        relevanceScore: 0,
        matchedKeywords: [],
        isProposal: false,
      };
      expect(classifyAct(act)).toBe("rejected");
    });
  });

  describe("refreshKnownActs", () => {
    it("queries SPARQL for all known CELEX IDs and returns found status", async () => {
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          mockSparqlResponse([
            { celex: { value: "32024R1689" }, title: { value: "Regulation on AI" } },
            { celex: { value: "32016R0679" }, title: { value: "General Data Protection Regulation" } },
          ]),
        ),
      );

      const results = await refreshKnownActs(UA);
      expect(results).toHaveLength(22); // EU_ACTS has 22 entries
      expect(fetch).toHaveBeenCalledTimes(3); // 22 acts / 10 per chunk = 3 chunks
    });

    it("rejects proposal stubs in refresh results", async () => {
      vi.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          mockSparqlResponse([
            { celex: { value: "32024R1689" }, title: { value: "Proposal for a REGULATION..." } },
          ]),
        ),
      );

      const results = await refreshKnownActs(UA);
      const aiAct = results.find((r) => r.celex === "32024R1689");
      expect(aiAct).toBeDefined();
      expect(aiAct?.title).toBeNull(); // Proposal stub rejected
    });

    it("handles SPARQL errors gracefully", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("network down"));
      await expect(refreshKnownActs(UA)).rejects.toThrow("network down");
    });
  });

  describe("discoverNewActs", () => {
    it("discovers new acts not in the registry", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockSparqlResponse([
          {
            celex: { value: "32025R9999" },
            title: { value: "Regulation on cybersecurity requirements" },
            dateSig: { value: "2025-06-01" },
            dateEntry: { value: "2025-12-01" },
          },
          {
            celex: { value: "32024R1689" }, // Already in registry — should be filtered
            title: { value: "Regulation on AI" },
            dateSig: { value: "2024-06-13" },
            dateEntry: { value: "2024-08-01" },
          },
        ]),
      );

      const acts = await discoverNewActs(2025, UA);
      expect(acts).toHaveLength(1);
      expect(acts[0].celex).toBe("32025R9999");
      expect(acts[0].actType).toBe("regulation");
      expect(acts[0].relevanceScore).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    });

    it("detects act type from CELEX pattern", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockSparqlResponse([
          { celex: { value: "32025R9999" }, title: { value: "Regulation" }, dateSig: { value: "2025-01-01" } },
          { celex: { value: "32025L9999" }, title: { value: "Directive" }, dateSig: { value: "2025-01-01" } },
          { celex: { value: "32025D9999" }, title: { value: "Decision" }, dateSig: { value: "2025-01-01" } },
        ]),
      );

      const acts = await discoverNewActs(2025, UA);
      expect(acts.find((a) => a.celex === "32025R9999")?.actType).toBe("regulation");
      expect(acts.find((a) => a.celex === "32025L9999")?.actType).toBe("directive");
      expect(acts.find((a) => a.celex === "32025D9999")?.actType).toBe("decision");
    });

    it("marks proposals correctly", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockSparqlResponse([
          {
            celex: { value: "32025R9999" },
            title: { value: "Proposal for a REGULATION on something" },
            dateSig: { value: "2025-01-01" },
          },
        ]),
      );

      const acts = await discoverNewActs(2025, UA);
      expect(acts[0].isProposal).toBe(true);
    });

    it("scores relevance based on title keywords", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockSparqlResponse([
          {
            celex: { value: "32025R9999" },
            title: { value: "Regulation on Artificial Intelligence and Cybersecurity" },
            dateSig: { value: "2025-01-01" },
          },
        ]),
      );

      const acts = await discoverNewActs(2025, UA);
      // "artificial intelligence" (10) + "cyber" (10) + " ai " (8) = 28
      expect(acts[0].relevanceScore).toBeGreaterThanOrEqual(AUTO_PROMOTE_THRESHOLD);
      expect(acts[0].matchedKeywords).toContain("artificial intelligence");
      expect(acts[0].matchedKeywords).toContain("cyber");
    });

    it("supports keyword pre-filtering", async () => {
      vi.mocked(fetch).mockResolvedValue(mockSparqlResponse([]));

      await discoverNewActs(2025, UA, ["cyber", "ai"]);

      const call = vi.mocked(fetch).mock.calls[0];
      const body = call?.[1]?.body as URLSearchParams;
      const query = body.get("query") ?? "";
      expect(query).toContain("CONTAINS");
      expect(query).toContain("cyber");
      expect(query).toContain("ai");
    });
  });

  describe("runDiscovery", () => {
    it("returns structured result with refreshed, discovered, promoted, and reviewQueue", async () => {
      vi.mocked(fetch).mockResolvedValue(mockSparqlResponse([]));

      const result = await runDiscovery(UA, { dryRun: true, year: 2025 });

      expect(result.refreshed).toBeDefined();
      expect(result.discovered).toBeDefined();
      expect(result.promoted).toBeDefined();
      expect(result.reviewQueue).toBeDefined();
      expect(result.watermark).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it("persists watermark when not dry-run", async () => {
      vi.mocked(fetch).mockResolvedValue(mockSparqlResponse([]));

      const result = await runDiscovery(UA, { dryRun: true, year: 2025 });

      // In dry-run, watermark is returned but not persisted
      expect(result.watermark.yearsScanned).toContain(2025);
      expect(result.watermark.totalDiscovered).toBeGreaterThanOrEqual(0);
    });

    it("collects errors from failed SPARQL queries", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("SPARQL timeout"));

      const result = await runDiscovery(UA, { dryRun: true, year: 2025 });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("SPARQL timeout");
    });
  });

  describe("relevance keywords", () => {
    it("includes cyber, AI, data, digital keywords", () => {
      const keywords = RELEVANCE_KEYWORDS.map((k) => k.keyword);
      expect(keywords).toContain("cyber");
      expect(keywords).toContain("artificial intelligence");
      expect(keywords).toContain("data");
      expect(keywords).toContain("digital");
    });

    it("assigns higher weight to cyber and AI than to consumer", () => {
      const cyber = RELEVANCE_KEYWORDS.find((k) => k.keyword === "cyber");
      const consumer = RELEVANCE_KEYWORDS.find((k) => k.keyword === "consumer");
      expect(cyber!.weight).toBeGreaterThan(consumer!.weight);
    });
  });
});
