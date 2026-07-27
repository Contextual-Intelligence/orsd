/**
 * Route aggregator — mounts all API routes.
 */

import { Router } from "express";
import healthRouter from "./health.js";
import companiesRouter from "./v1/companies.js";
import signalsRouter from "./v1/signals.js";
import statsRouter from "./v1/stats.js";

const router = Router();

// Health
router.use("/api/health", healthRouter);

// Dataset root
router.get("/", (_req, res) => {
  res.json({
    name: "Open Regulatory Signal Dataset (ORSD)",
    version: "0.1",
    description:
      "A public dataset of regulatory signals — FDA clearances, clinical trials, and market-moving news — aggregated from 22+ data sources across 10 regulatory jurisdictions.",
    license: "Database compilation: ODbL v1.0 — individual data retains original source licenses",
    attribution: "Source: orsd.contextual-intelligence.org",
    source_licenses: "https://github.com/contextual-intelligence/orsd#data-sources-and-attribution",
    endpoints: {
      stats: "/v1/stats",
      companies: "/v1/companies",
      signals: "/v1/signals",
    },
    docs: "https://github.com/contextual-intelligence/orsd",
    updated_at: new Date().toISOString(),
  });
});

// V1
router.use("/v1/companies", companiesRouter);
router.use("/v1/signals", signalsRouter);
router.use("/v1/stats", statsRouter);

export default router;
