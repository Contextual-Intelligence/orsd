import { describe, it, expect, vi, beforeEach } from "vitest";
import { deduplicateSignals, computeOrsdId } from "../../src/pipeline/dedup.js";
import type { NormalizedSignal } from "../../src/types.js";

const makeSignal = (externalId: string, source = "test"): NormalizedSignal => ({
  id: computeOrsdId(source, externalId),
  externalId,
  source,
  jurisdiction: "US",
  type: "FDA_510K",
  title: `Device ${externalId}`,
  description: "",
  date: "2026-01-01",
  url: "",
  confidence: "medium",
  metadata: {},
  ingestedAt: "2026-01-01T00:00:00.000Z",
});

const TEST_CONFIG = {
  dgraphUrl: "http://test-dgraph:8080",
  elasticsearchUrl: "http://test-es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

describe("computeOrsdId", () => {
  it("should produce deterministic IDs", () => {
    const a = computeOrsdId("fda", "K123456");
    const b = computeOrsdId("fda", "K123456");
    expect(a).toBe(b);
  });

  it("should produce different IDs for different sources", () => {
    const a = computeOrsdId("fda", "K123456");
    const b = computeOrsdId("eudamed", "K123456");
    expect(a).not.toBe(b);
  });

  it("should produce different IDs for different externalIds", () => {
    const a = computeOrsdId("fda", "K123456");
    const b = computeOrsdId("fda", "K123457");
    expect(a).not.toBe(b);
  });

  it("should return a 64-char hex string (full SHA-256)", () => {
    const id = computeOrsdId("fda", "K123456");
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("deduplicateSignals", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("should return all signals when nothing exists in Dgraph", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { querySignal: [] } }), { status: 200 }),
    );

    const signals = [makeSignal("a"), makeSignal("b")];
    const result = await deduplicateSignals(signals, TEST_CONFIG);
    expect(result).toHaveLength(2);
  });

  it("should filter out signals whose ORSD ID already exists in Dgraph", async () => {
    const dupId = computeOrsdId("test", "dup-1");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { querySignal: [{ id: dupId }] } }),
        { status: 200 },
      ),
    );

    const signals = [makeSignal("dup-1"), makeSignal("new-1")];
    const result = await deduplicateSignals(signals, TEST_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe("new-1");
  });

  it("should return empty array for empty input", async () => {
    const result = await deduplicateSignals([], TEST_CONFIG);
    expect(result).toEqual([]);
  });

  it("should proceed without dedup when Dgraph is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Connection refused"));

    const signals = [makeSignal("a"), makeSignal("b")];
    const result = await deduplicateSignals(signals, TEST_CONFIG);
    expect(result).toHaveLength(2);
  });

  it("should handle paginated Dgraph responses", async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, i) => ({
      id: computeOrsdId("test", `existing-${i}`),
    }));
    const secondBatch = [{ id: computeOrsdId("test", "dup-target") }];

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { querySignal: firstBatch } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { querySignal: secondBatch } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { querySignal: [] } }), { status: 200 }),
      );

    const signals = [
      makeSignal("dup-target"), // should be filtered
      makeSignal("new-signal"), // should pass
    ];
    const result = await deduplicateSignals(signals, TEST_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe("new-signal");
  });
});
