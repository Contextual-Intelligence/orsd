/**
 * ORSD Crawler Orchestrator
 *
 * Coordinates fetching from all registered source connectors,
 * runs ETL (normalize + enrich + dedup + confidence scoring),
 * and writes results to Dgraph in batches.
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

/** Batch size for Dgraph writes — 50 signals per mutation to avoid payload limits. */
const BATCH_SIZE = 50;

/** Maximum number of concurrent source fetches. */
const MAX_CONCURRENCY = 3;

export interface OrchestratorOptions {
  /** Only crawl specific sources (by name). Empty = all. */
  sources?: string[];
  /** Dry run: don't write to storage */
  dryRun?: boolean;
  /** Concurrency limit for parallel source fetching */
  concurrency?: number;
}

export async function runOrchestrator(options: OrchestratorOptions = {}): Promise<CrawlResult[]> {
  const config = loadConfig();
  const sources = getAllSources();
  const concurrency = options.concurrency ?? MAX_CONCURRENCY;

  // Filter sources
  const active = options.sources?.length
    ? sources.filter((s) => options.sources!.includes(s.name))
    : sources;

  if (active.length === 0) {
    logger.warn({ requested: options.sources }, "No matching sources found");
    return [];
  }

  logger.info({ sources: active.map((s) => s.name), concurrency, dryRun: !!options.dryRun }, "Starting crawl");

  const results: CrawlResult[] = [];

  // Process sources with limited concurrency
  const queues = Array.from({ length: concurrency }, (_, i) => i);
  const iter = active.entries();

  await Promise.all(
    queues.map(async () => {
      for (const [, source] of iter) {
        const result = await crawlSource(source.name, source.jurisdiction, () =>
          source.fetch(config),
          () => options.dryRun ?? false,
          config,
        );
        results.push(result);
      }
    }),
  );

  // Sort results by source name for deterministic output
  results.sort((a, b) => a.source.localeCompare(b.source));

  const total = results.reduce((sum, r) => sum + r.ingested, 0);
  const failed = results.filter((r) => r.errors.length > 0).length;
  logger.info({ total, failed }, "Orchestration complete");

  return results;
}

/**
 * Crawl a single source through the full pipeline.
 * Extracted from the orchestrator for testability and clear error isolation.
 */
export async function crawlSource(
  sourceName: string,
  jurisdiction: CrawlResult["jurisdiction"],
  fetchFn: () => Promise<RawSignal[]>,
  isDryRun: () => boolean,
  config: ReturnType<typeof loadConfig>,
): Promise<CrawlResult> {
  const logger = pino({ name: `orsd/${sourceName}` });
  const start = Date.now();
  const result: CrawlResult = {
    source: sourceName,
    jurisdiction,
    fetched: 0,
    normalized: 0,
    deduplicated: 0,
    ingested: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    logger.info("Starting crawl");

    // 1. Fetch raw signals
    const raw: RawSignal[] = await fetchFn();
    result.fetched = raw.length;
    logger.info({ count: raw.length }, "Fetched raw signals");

    // 2. Normalize to canonical shape
    const normalized: NormalizedSignal[] = normalizeSignals(raw);
    result.normalized = normalized.length;

    // 3. Enrich with company matching, product codes, etc.
    const enriched: NormalizedSignal[] = await enrichSignals(normalized);
    logger.info({ enriched: enriched.length }, "Enrichment complete");

    // 4. Deduplicate against existing signals
    const deduped: NormalizedSignal[] = await deduplicateSignals(enriched, config);
    result.deduplicated = deduped.length;
    logger.info({ deduped: deduped.length, duplicates: enriched.length - deduped.length }, "Deduplication complete");

    // 5. Score confidence
    const scored: NormalizedSignal[] = scoreConfidence(deduped);
    logger.info({ scored: scored.length }, "Confidence scoring complete");

    // 6. Ingest to Dgraph in batches
    if (!isDryRun() && scored.length > 0) {
      const ingested = await batchWriteSignals(scored, config);
      result.ingested = ingested;
    } else {
      result.ingested = scored.length;
    }

    logger.info({ ingested: result.ingested, duration: Date.now() - start }, "Crawl complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    result.errors.push(msg);
    logger.error({ error: msg, stack }, "Crawl failed");
  }

  result.durationMs = Date.now() - start;
  return result;
}

/**
 * Write signals to Dgraph in batches using GraphQL mutations.
 * Falls back to individual writes on batch failure for partial tolerance.
 */
async function batchWriteSignals(signals: NormalizedSignal[], config: ReturnType<typeof loadConfig>): Promise<number> {
  const url = `${config.dgraphUrl}/graphql`;
  let ingested = 0;
  let failed = 0;

  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const mutation = buildBatchMutation(batch);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        ingested += batch.length;
      } else {
        // Batch failed — fall back to individual writes for this batch
        const individualResult = await fallbackIndividualWrites(batch, url);
        ingested += individualResult.ingested;
        failed += batch.length - individualResult.ingested;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ batch: i / BATCH_SIZE, error: msg }, "Batch write failed, falling back to individual writes");
      const individualResult = await fallbackIndividualWrites(batch, url);
      ingested += individualResult.ingested;
      failed += batch.length - individualResult.ingested;
    }
  }

  if (failed > 0) {
    logger.warn({ ingested, failed }, "Partial write failure");
  }

  return ingested;
}

function buildBatchMutation(signals: NormalizedSignal[]): string {
  const inputs = signals
    .map((s) => {
      const confidence = s.confidence === "high" ? 0.9 : s.confidence === "medium" ? 0.6 : 0.3;
      return `{
        id: ${JSON.stringify(s.id)},
        type: ${JSON.stringify(s.type)},
        date: ${JSON.stringify(s.date)},
        confidence: ${confidence},
        description: ${JSON.stringify(s.description?.slice(0, 5000) ?? "")},
        url: ${JSON.stringify(s.url ?? "")}
      }`;
    })
    .join(",\n");

  return `mutation { addSignal(input: [${inputs}]) { signal { id } } }`;
}

async function fallbackIndividualWrites(
  batch: NormalizedSignal[],
  url: string,
): Promise<{ ingested: number }> {
  let ingested = 0;

  for (const signal of batch) {
    try {
      const mutation = buildBatchMutation([signal]);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        ingested++;
      }
    } catch {
      // Individual failure — skip this signal
    }
  }

  return { ingested };
}
