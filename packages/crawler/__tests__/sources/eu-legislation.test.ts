import { describe, it, expect, vi, beforeEach } from "vitest"
import { EuLegislationSource, EU_ACTS, findAct } from "../../src/sources/eu-legislation/index.js"
import type { CrawlerConfig } from "../../src/config.js"

const CONFIG: CrawlerConfig = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
}

describe("EuLegislationSource", () => {
  let source: EuLegislationSource

  beforeEach(() => {
    source = new EuLegislationSource()
    global.fetch = vi.fn()
  })

  it("should return expected metadata", () => {
    expect(source.name).toBe("eu-legislation")
    expect(source.jurisdiction).toBe("EU")
  })

  it("should emit one REGULATORY_UPDATE signal per EU act even when EUR-Lex is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"))

    const signals = await source.fetch(CONFIG)

    expect(signals).toHaveLength(EU_ACTS.length)
    expect(signals.length).toBeGreaterThanOrEqual(10)
    for (const s of signals) {
      expect(s.source).toBe("eu-legislation")
      expect(s.jurisdiction).toBe("EU")
      expect(s.type).toBe("REGULATORY_UPDATE")
      expect(s.externalId).toMatch(/^eu-3\d{4}[A-Z]\d{4}$/)
      expect(s.date).toBeTruthy()
      expect(s.url).toMatch(/^https:\/\/eur-lex\.europa\.eu\//)
    }
  })

  it("should include the Cyber Resilience Act (CRA) with correct metadata", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }))

    const signals = await source.fetch(CONFIG)
    const cra = signals.find((s) => s.metadata?.celex === "32024R2847")

    expect(cra).toBeDefined()
    expect(cra!.title).toContain("Cyber Resilience Act")
    expect(cra!.metadata).toMatchObject({
      celex: "32024R2847",
      actType: "regulation",
      status: "applying",
      digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/library/cyber-resilience-act",
    })
  })

  it("should enrich with the official EUR-Lex title when the SPARQL endpoint responds", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            head: { vars: ["t"] },
            results: {
              bindings: [
                { t: { type: "literal", value: "Regulation (EU) 2024/2847 — OFFICIAL TITLE" } },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    )

    const signals = await source.fetch(CONFIG)
    expect(signals).toHaveLength(EU_ACTS.length)
    // Every act gets a fresh Response (body is consumed by res.json()); verify enrichment is wired through
    for (const s of signals) {
      expect(s.metadata?.officialTitle).toBe("Regulation (EU) 2024/2847 — OFFICIAL TITLE")
      expect(s.description).toContain("OFFICIAL TITLE")
    }
  })

  it("should degrade gracefully on partial SPARQL failures", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockRejectedValue(new Error("timeout"))

    const signals = await source.fetch(CONFIG)
    expect(signals).toHaveLength(EU_ACTS.length)
    // Every signal still has a valid title from the curated registry
    for (const s of signals) {
      expect(s.title).toBeTruthy()
      expect(s.metadata?.officialTitle).toBeNull()
    }
  })

  it("should have deterministic external IDs", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("down"))
    const a = await source.fetch(CONFIG)
    const b = await source.fetch(CONFIG)
    expect(a.map((s) => s.externalId)).toEqual(b.map((s) => s.externalId))
  })
})

describe("EU acts registry", () => {
  it("should contain all key EU digital-strategy acts", () => {
    const celexes = EU_ACTS.map((a) => a.celex)
    expect(celexes).toEqual(
      expect.arrayContaining([
        "32024R2847", // Cyber Resilience Act
        "32024R1689", // AI Act
        "32023R2854", // Data Act
        "32022L2555", // NIS2
        "32016R0679", // GDPR
      ]),
    )
  })

  it("should look up acts by CELEX", () => {
    expect(findAct("32024R2847")?.shortName).toBe("Cyber Resilience Act (CRA)")
    expect(findAct("does-not-exist")).toBeUndefined()
  })

  it("every act should have valid EUR-Lex URLs and dates", () => {
    for (const act of EU_ACTS) {
      expect(act.eurlexUrl).toMatch(/^https:\/\/eur-lex\.europa\.eu\/eli\//)
      expect(act.adoptionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(act.entryIntoForce).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(act.applicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
