import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnvisaSource } from "../../src/sources/anvisa/index.js";
import type { CrawlerConfig } from "../../src/config.js";

const CONFIG: CrawlerConfig = {
  dgraphUrl: "http://dgraph:8080",
  elasticsearchUrl: "http://es:9200",
  defaultIntervalHours: 24,
  maxSignalsPerSource: 5000,
  userAgent: "ORSD-Test/1.0",
};

/** Simulated ANVISA open data API response (code accesses response.content). */
const MOCK_ANVISA_API = {
  content: [
    {
      numeroRegistro: "BR-001",
      nomeProduto: "Stent Cardiovascular X100",
      nomeFabricante: "Boston Scientific",
      categoriaRisco: "Classe IV",
      dataConcessao: "15/06/2025",
      dataValidade: "15/06/2028",
      classeProduto: "Cardiovascular",
    },
    {
      numeroRegistro: "BR-002",
      nomeProduto: "Kit Diagnóstico Dengue",
      nomeFabricante: "Fiocruz",
      categoriaRisco: "Classe III",
      dataConcessao: "01/03/2026",
      classeProduto: "Diagnóstico In Vitro",
    },
  ],
};

/** Simulated ANVISA CSV export (code does not parse date from CSV). */
const MOCK_ANVISA_CSV = `numero_registro,nome_produto,fabricante,classe_risco,data_concessao
BR-003,Monitor Cardíaco Modelo 200,Medtronic,Classe III,10/01/2025
BR-004,Aparelho de Ultrassom,GE Healthcare,Classe II,22/11/2024`;

describe("AnvisaSource", () => {
  let source: AnvisaSource;

  beforeEach(() => {
    source = new AnvisaSource();
    global.fetch = vi.fn();
  });

  it("should return expected metadata", () => {
    expect(source.name).toBe("anvisa");
    expect(source.jurisdiction).toBe("BR");
  });

  it("should parse API response with Brazilian dates", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_ANVISA_API), { status: 200 }),
    );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2);

    const s1 = signals.find((s) => s.externalId?.includes("BR-001"));
    expect(s1).toBeDefined();
    expect(s1!.companyName).toBe("Boston Scientific");
    expect(s1!.productName).toBe("Stent Cardiovascular X100");
    expect(s1!.type).toBe("ANVISA_REGISTRATION");
    // BR date 15/06/2025 → ISO 2025-06-15
    expect(s1!.date).toBe("2025-06-15");
    expect(s1!.metadata?.riskCategory).toBe("Classe IV");
  });

  it("should fall back to CSV when API fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("API error", { status: 500 })) // API
      .mockResolvedValueOnce( // CSV
        new Response(MOCK_ANVISA_CSV, { status: 200 }),
      );

    const signals = await source.fetch(CONFIG);
    expect(signals).toHaveLength(2);
    expect(signals[0].companyName).toBe("Medtronic");
    expect(signals[0].productName).toBe("Monitor Cardíaco Modelo 200");
    // Code does not parse dates from CSV — date is empty string
    expect(signals[0].date).toBe("");
  });

  it("should return empty when all strategies fail", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    const signals = await source.fetch(CONFIG);
    expect(signals).toEqual([]);
  });
});
