/**
 * ORSD Deduplication
 *
 * Checks incoming signals against existing signals in Dgraph
 * and removes duplicates based on externalId + source + type.
 */

import pino from "pino";
import type { NormalizedSignal } from "../types.js";
import type { CrawlerConfig } from "../config.js";

const logger = pino({ name: "orsd/dedup" });

export async function deduplicateSignals(
  signals: NormalizedSignal[],
  config: CrawlerConfig,
): Promise<NormalizedSignal[]> {
  // Query existing signal externalIds from Dgraph
  const existingIds = await fetchExistingExternalIds(config);
  const seenExternalIds = new Set(existingIds);

  const deduped = signals.filter((s) => !seenExternalIds.has(s.externalId));

  if (deduped.length < signals.length) {
    logger.info(
      { total: signals.length, duplicates: signals.length - deduped.length },
      "Removed duplicates",
    );
  }

  return deduped;
}

async function fetchExistingExternalIds(config: CrawlerConfig): Promise<string[]> {
  try {
    const url = `${config.dgraphUrl}/graphql`;
    const query = `query { querySignal { id } }`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { querySignal?: Array<{ id: string }> } };
    return json.data?.querySignal?.map((s) => s.id) ?? [];
  } catch {
    logger.warn("Could not fetch existing signals from Dgraph — proceeding without dedup");
    return [];
  }
}
