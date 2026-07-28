#!/usr/bin/env node

/**
 * ORSD API — Entry Point
 *
 * Starts the standalone public API for the Open Regulatory Signal Dataset.
 * Applies the Dgraph schema on startup, then serves read-only endpoints.
 */

import pino from "pino";
import { initDgraph } from "./services/dgraph.js";
import { ORSD_DGRAPH_SCHEMA } from "./schema/dgraph.js";
import { startServer } from "./app.js";

const logger = pino({ name: "orsd/api" });

async function main() {
  // Initialize Dgraph client
  const dgraphUrl = process.env.DGRAPH_URL ?? "http://localhost:8080";
  initDgraph({ url: dgraphUrl });

  // Apply schema (idempotent — Dgraph merges type additions)
  try {
    const res = await fetch(`${dgraphUrl}/admin/schema`, {
      method: "POST",
      headers: { "Content-Type": "application/graphql" },
      body: ORSD_DGRAPH_SCHEMA,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      logger.info("Dgraph schema applied");
    } else {
      const text = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: text.slice(0, 200) }, "Dgraph schema update returned non-ok — continuing");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: msg }, "Dgraph schema update failed — continuing (will retry on next restart)");
  }

  // Start HTTP server
  const port = parseInt(process.env.PORT || "3003", 10);
  startServer(port);

  logger.info({ port, dgraphUrl }, "ORSD API initialized");
}

main().catch((err) => {
  logger.fatal({ error: err instanceof Error ? err.message : String(err) }, "API startup failed");
  process.exit(1);
});
