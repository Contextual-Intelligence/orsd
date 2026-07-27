/**
 * ORSD Deduplication
 *
 * Checks incoming signals against existing signals in Dgraph
 * and removes duplicates. Dedup is based on the ORSD signal ID
 * (SHA-256 of `source:externalId`), which is deterministic.
 *
 * Uses paginated queries to handle large existing datasets.
 */

import { createHash } from "node:crypto";
import pino from "pino";
import type { NormalizedSignal } from "../types.js";
import type { CrawlerConfig } from "../config.js";

const logger = pino({ name: "orsd/dedup" });

/** Number of existing IDs to fetch per paginated request. */
const PAGE_SIZE = 1000;

/** Max pages to fetch (safety limit — 100k IDs). */
const MAX_PAGES = 100;

export async function deduplicateSignals(
  signals: NormalizedSignal[],
  config: CrawlerConfig,
): Promise<NormalizedSignal[]> {
  if (signals.length === 0) return [];

  // Compute the expected ORSD ID for each incoming signal
  // These are deterministic from source + externalId
  const incomingIds = new Set(
    signals.map((s) => computeOrsdId(s.source, s.externalId)),
  );

  // Fetch existing ORSD IDs already stored in Dgraph
  const existingIds = await fetchAllExistingIds(config);

  // A signal is a duplicate if its ORSD ID already exists in Dgraph
  const deduped = signals.filter((s) => {
    const orsdId = computeOrsdId(s.source, s.externalId);
    return !existingIds.has(orsdId);
  });

  const removed = signals.length - deduped.length;
  if (removed > 0) {
    logger.info({ total: signals.length, removed }, "Removed duplicates");
  }

  return deduped;
}

/**
 * Compute the deterministic ORSD ID for a signal.
 * Must match the logic in etl/normalize.ts.
 */
export function computeOrsdId(source: string, externalId: string): string {
  return createHash("sha256")
    .update(`${source}:${externalId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Fetch all existing ORSD signal IDs from Dgraph using paginated queries.
 * Falls back to empty set on error (proceeds without dedup).
 */
async function fetchAllExistingIds(config: CrawlerConfig): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  let pages = 0;

  while (pages < MAX_PAGES) {
    try {
      const url = `${config.dgraphUrl}/graphql`;
      const query = `query { querySignal(first: ${PAGE_SIZE}, offset: ${offset}) { id } }`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "Dgraph query returned non-OK — proceeding without dedup");
        return ids;
      }

      const json = (await res.json()) as {
        data?: { querySignal?: Array<{ id: string }> };
        errors?: Array<{ message: string }>;
      };

      if (json.errors) {
        logger.warn(
          { errors: json.errors.map((e) => e.message).join("; ") },
          "Dgraph query error — proceeding without dedup",
        );
        return ids;
      }

      const batch = json.data?.querySignal ?? [];
      if (batch.length === 0) break;

      for (const signal of batch) {
        ids.add(signal.id);
      }

      offset += batch.length;
      pages++;

      if (batch.length < PAGE_SIZE) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ error: msg }, "Dgraph unavailable — proceeding without dedup");
      return ids;
    }
  }

  if (pages >= MAX_PAGES) {
    logger.warn({ totalIds: ids.size }, "Reached pagination limit — dedup may be incomplete");
  }

  return ids;
}
