#!/usr/bin/env node

/**
 * ORSD Crawler — Entry Point
 *
 * Usage:
 *   npm run start                     # crawl all sources
 *   npm run start -- --sources fda    # crawl only FDA
 *   npm run start -- --dry-run        # dry run (no writes)
 */

import pino from "pino";
import { runOrchestrator } from "./pipeline/orchestrator.js";

const logger = pino({ name: "orsd/crawler" });

const args = process.argv.slice(2);
const sourcesFlag = args.indexOf("--sources");
const sources = sourcesFlag >= 0 ? args[sourcesFlag + 1]?.split(",") : undefined;
const dryRun = args.includes("--dry-run");

async function main() {
  logger.info({ sources: sources ?? "all", dryRun }, "ORSD Crawler starting");

  const results = await runOrchestrator({ sources, dryRun });

  for (const r of results) {
    if (r.errors.length > 0) {
      logger.error({ source: r.source, errors: r.errors }, "Crawl finished with errors");
    } else {
      logger.info(
        { source: r.source, ingested: r.ingested, durationMs: r.durationMs },
        "Crawl finished successfully",
      );
    }
  }

  const total = results.reduce((sum, r) => sum + r.ingested, 0);
  const failed = results.filter((r) => r.errors.length > 0).length;
  logger.info({ total, failed, totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0) }, "All crawls complete");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  logger.fatal({ error: err instanceof Error ? err.message : String(err) }, "Crawler crashed");
  process.exit(1);
});
