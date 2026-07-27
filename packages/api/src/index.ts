#!/usr/bin/env node

/**
 * ORSD API — Entry Point
 *
 * Starts the standalone public API for the Open Regulatory Signal Dataset.
 * Reads from Dgraph and serves read-only endpoints.
 */

import pino from "pino";
import { initDgraph } from "./services/dgraph.js";
import { startServer } from "./app.js";

const logger = pino({ name: "orsd/api" });

function main() {
  // Initialize Dgraph client
  initDgraph({
    url: process.env.DGRAPH_URL ?? "http://localhost:8080",
  });

  // Start HTTP server
  const port = parseInt(process.env.PORT || "3003", 10);
  startServer(port);

  logger.info({ port, dgraphUrl: process.env.DGRAPH_URL ?? "http://localhost:8080" }, "ORSD API initialized");
}

main();
