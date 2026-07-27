/**
 * ORSD Crawler Orchestrator
 *
 * Coordinates fetching from all registered source connectors,
 * runs ETL (normalize + enrich + dedup + confidence scoring),
 * and writes results to Dgraph and Elasticsearch.
 */

import pino from "pino";
import { loadConfig } from "../config.js";
import type { CrawlResult, RawSignal, NormalizedSignal } from "../types.js";
import { normalizeSignals } from "../etl/normalize.js";
import { enrichSignals } from "../etl/enrich.js";
import { deduplicateSignals } from "./dedup.js";
import { scoreConfidence } from "./confidence.js";
import { getAllSources } from "../sources/index.js";

const logger = pino({ name: "orsd/orchestrator" });

export interface OrchestratorOptions {
  /** Only crawl specific sources (by name). Empty = all. */
  sources?: string[];
  /** Dry run: don't write to storage */
  dryRun?: boolean;
}

export async function runOrchestrator(options: OrchestratorOptions = {}): Promise<CrawlResult[]> {
  const config = loadConfig();
  const sources = getAllSources();
  const results: CrawlResult[] = [];

  for (const source of sources) {
    if (options.sources && options.sources.length > 0 && !options.sources.includes(source.name)) {
      continue;
    }

    logger.info({ source: source.name }, "Starting crawl");

    const start = Date.now();
    const result: CrawlResult = {
      source: source.name,
      jurisdiction: source.jurisdiction,
      fetched: 0,
      normalized: 0,
      deduplicated: 0,
      ingested: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 1. Fetch raw signals from the source
      const raw: RawSignal[] = await source.fetch(config);
      result.fetched = raw.length;
      logger.info({ source: source.name, count: raw.length }, "Fetched raw signals");

      // 2. Normalize to canonical shape
      const normalized: NormalizedSignal[] = normalizeSignals(raw);
      result.normalized = normalized.length;

      // 3. Enrich with company matching, product codes, etc.
      const enriched: NormalizedSignal[] = await enrichSignals(normalized);
      logger.info({ source: source.name, enriched: enriched.length }, "Enrichment complete");

      // 4. Deduplicate against existing signals in Dgraph
      const deduped: NormalizedSignal[] = await deduplicateSignals(enriched, config);
      result.deduplicated = deduped.length;
      logger.info({ source: source.name, deduped: deduped.length }, "Deduplication complete");

      // 5. Score confidence
      const scored: NormalizedSignal[] = scoreConfidence(deduped);
      logger.info({ source: source.name, scored: scored.length }, "Confidence scoring complete");

      // 6. Ingest to Dgraph
      if (!options.dryRun) {
        await writeSignals(scored, config);
      }
      result.ingested = scored.length;

      logger.info({ source: source.name, ingested: result.ingested }, "Crawl complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      logger.error({ source: source.name, error: msg }, "Crawl failed");
    }

    result.durationMs = Date.now() - start;
    results.push(result);
  }

  return results;
}

async function writeSignals(signals: NormalizedSignal[], config: ReturnType<typeof loadConfig>): Promise<void> {
  // Write to Dgraph via GraphQL mutations
  const url = `${config.dgraphUrl}/graphql`;
  for (const signal of signals) {
    const mutation = `
      mutation {
        addSignal(input: [{
          id: "${signal.id}",
          type: "${signal.type}",
          date: "${signal.date}",
          confidence: ${signal.confidence === "high" ? 0.9 : signal.confidence === "medium" ? 0.6 : 0.3},
          description: ${JSON.stringify(signal.description)},
          url: ${JSON.stringify(signal.url)}
        }]) { signal { id } }
      }
    `;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation }),
    });
    if (!res.ok) {
      throw new Error(`Dgraph write failed: ${res.status} ${res.statusText}`);
    }
  }
}
