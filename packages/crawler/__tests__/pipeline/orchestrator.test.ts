import { describe, it, expect, vi, beforeEach } from "vitest";
import { crawlSource } from "../../src/pipeline/orchestrator.js";
import type { RawSignal, CrawlResult } from "../../src/types.js";

const CONFIG = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

describe("crawlSource", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("should return a CrawlResult with correct structure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { querySignal: [] } }), { status: 200 }),
    );

    const result: CrawlResult = await crawlSource(
      "test-source",
      "US",
      async () => [
        {
          externalId: "t1",
          source: "test-source",
          jurisdiction: "US",
          type: "FDA_510K",
          title: "Test",
          description: "A test signal.",
          date: "2026-01-01",
          url: "https://example.com/t1",
          companyName: "TestCorp",
        },
      ],
      () => true, // dry run
      CONFIG,
    );

    expect(result.source).toBe("test-source");
    expect(result.jurisdiction).toBe("US");
    expect(result.fetched).toBe(1);
    expect(result.normalized).toBe(1);
    expect(result.deduplicated).toBe(1);
    expect(result.ingested).toBe(1); // dry run counts as ingested
    expect(result.errors).toEqual([]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should capture fetch errors in result.errors", async () => {
    const result = await crawlSource(
      "failing-source",
      "EU",
      async () => {
        throw new Error("API timeout");
      },
      () => true,
      CONFIG,
    );

    expect(result.fetched).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe("API timeout");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty fetch results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { querySignal: [] } }), { status: 200 }),
    );

    const result = await crawlSource(
      "empty-source",
      "AU",
      async () => [],
      () => true,
      CONFIG,
    );

    expect(result.fetched).toBe(0);
    expect(result.normalized).toBe(0);
    expect(result.deduplicated).toBe(0);
    expect(result.ingested).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("should count ingested after batch write when not dry run", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { querySignal: [] } }), { status: 200 }),
      ) // Dgraph query for dedup
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { addSignal: { signal: [{ id: "1" }, { id: "2" }] } } }), {
          status: 200,
        }),
      ); // Batch write

    const result = await crawlSource(
      "write-source",
      "BR",
      async () => [
        { externalId: "w1", source: "write-source", jurisdiction: "BR", type: "ANVISA_REGISTRATION", title: "A", description: "", date: "2026-01-01", url: "" },
        { externalId: "w2", source: "write-source", jurisdiction: "BR", type: "ANVISA_REGISTRATION", title: "B", description: "", date: "2026-01-01", url: "" },
      ],
      () => false, // not dry run — actually writes
      CONFIG,
    );

    expect(result.fetched).toBe(2);
    expect(result.ingested).toBe(2);
    expect(result.errors).toEqual([]);
  });
});
