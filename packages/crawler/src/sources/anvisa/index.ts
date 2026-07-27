/**
 * ANVISA Source Connector
 *
 * Brazilian Health Regulatory Agency — medical device registrations
 * published through the Brazilian Open Data Portal (dados.gov.br).
 *
 * ANVISA publishes their medical device registry as CSV files at:
 *   https://dados.gov.br/dados/conjuntos-dados/cadastro-de-produtos-medicos
 *
 * The CSV includes: product name, registration number, company, risk class,
 * validity dates, and product classification.
 *
 * Data portal: https://dados.gov.br/dados/conjuntos-dados/cadastro-de-produtos-medicos
 * API: https://apidadosabertos.anvisa.gov.br/
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const CSV_URL = "https://dados.gov.br/dados/conjuntos-dados/cadastro-de-produtos-medicos";
const API_BASE = "https://apidadosabertos.anvisa.gov.br";

interface AnvisaApiProduct {
  numeroRegistro?: string;
  nomeProduto?: string;
  nomeFabricante?: string;
  categoriaRisco?: string;
  dataConcessao?: string;
  dataValidade?: string;
  classeProduto?: string;
  modelo?: string;
}

/**
 * Parses a Brazilian date string (DD/MM/YYYY) to ISO format.
 */
function parseBrDate(dateStr?: string): string {
  if (!dateStr) return "";
  // Some fields are already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : dateStr;
}

export class AnvisaSource implements SourceConnector {
  name = "anvisa";
  jurisdiction = "BR" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Try the ANVISA Open Data API first
    try {
      const url = `${API_BASE}/produtos-medicos/v1/produtos?pagina=0&tamanho=100`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": config.userAgent,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          content?: AnvisaApiProduct[];
          totalPages?: number;
        };

        if (data.content) {
          for (const item of data.content) {
            signals.push({
              externalId: `anvisa-${item.numeroRegistro ?? item.nomeProduto ?? "unknown"}`,
              source: "anvisa",
              jurisdiction: "BR",
              type: "ANVISA_REGISTRATION",
              title: `ANVISA Registration — ${item.nomeProduto ?? "Unknown product"}`,
              description: `ANVISA registration ${item.numeroRegistro ?? "N/A"}: ${item.nomeProduto ?? "Unknown product"} by ${item.nomeFabricante ?? "Unknown manufacturer"}. Risk class: ${item.categoriaRisco ?? "N/A"}.`,
              date: parseBrDate(item.dataConcessao),
              url: `${CSV_URL}?search=${encodeURIComponent(item.numeroRegistro ?? "")}`,
              companyName: item.nomeFabricante,
              productName: item.nomeProduto,
              productCode: item.categoriaRisco,
              metadata: {
                registrationNumber: item.numeroRegistro,
                riskCategory: item.categoriaRisco,
                validityDate: parseBrDate(item.dataValidade),
                productClass: item.classeProduto,
              },
            });
          }
        }
      }
    } catch {
      // API unavailable — fallback will return empty
    }

    if (signals.length > 0) return signals;

    // Fallback: fetch CSV summary from the open data portal description
    try {
      const res = await fetch(`${CSV_URL}?format=csv`, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const text = await res.text();
        // CSV: try to parse first few rows
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length > 1) {
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
          const nameIdx = headers.findIndex((h) => h.includes("produto") || h.includes("nome"));
          const regIdx = headers.findIndex((h) => h.includes("registro") || h.includes("numero"));
          const manfIdx = headers.findIndex((h) => h.includes("fabricante") || h.includes("empresa"));

          for (let i = 1; i < Math.min(lines.length, config.maxSignalsPerSource); i++) {
            const cols = lines[i].split(",");
            const productName = nameIdx >= 0 ? cols[nameIdx]?.replace(/"/g, "") : undefined;
            const regNumber = regIdx >= 0 ? cols[regIdx]?.replace(/"/g, "") : undefined;
            signals.push({
              externalId: `anvisa-csv-${regNumber ?? `row-${i}`}`,
              source: "anvisa",
              jurisdiction: "BR",
              type: "ANVISA_REGISTRATION",
              title: `ANVISA Registration — ${productName ?? "Unknown"}`,
              description: `ANVISA product: ${productName ?? "Unknown"}. Registration: ${regNumber ?? "N/A"}. Manufacturer: ${manfIdx >= 0 ? cols[manfIdx]?.replace(/"/g, "") : "N/A"}.`,
              date: "",
              url: CSV_URL,
              companyName: manfIdx >= 0 ? cols[manfIdx]?.replace(/"/g, "") : undefined,
              productName,
              productCode: regNumber,
              metadata: { rawRow: lines[i].substring(0, 200) },
            });
          }
        }
      }
    } catch {
      // Silent fallthrough
    }

    return signals;
  }
}
