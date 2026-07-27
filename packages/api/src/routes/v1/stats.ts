/**
 * ORSD Stats Endpoint — adapted from monorepo platform/routes/orsd.ts
 *
 * GET /v1/stats — dataset statistics (company count, signal count,
 * signal types, coverage info).
 */

import { Router, type Request, type Response } from "express";
import { dgraph } from "../../services/dgraph.js";

const router = Router();

interface DgraphResult {
  queryCompany?: unknown[];
  querySignal?: Array<{ type: string }>;
  [key: string]: unknown;
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const [companies, signals] = await Promise.all([
      dgraph.query<DgraphResult>(`query { queryCompany { normalizedName } }`),
      dgraph.query<DgraphResult>(`query { querySignal { type } }`),
    ]);

    const cc = Array.isArray(companies?.queryCompany) ? companies.queryCompany.length : 0;
    const sc = Array.isArray(signals?.querySignal) ? signals.querySignal.length : 0;

    res.json({
      name: "Open Regulatory Signal Dataset (ORSD)",
      version: "0.1",
      license: "Database compilation: ODbL v1.0 — individual data retains original source licenses",
      attribution: "Source: orsd.contextual-intelligence.org",
      source_licenses: "https://github.com/contextual-intelligence/orsd#data-sources-and-attribution",
      stats: {
        companies: cc,
        signals: sc,
        signal_types: [...new Set((signals?.querySignal || []).map((s) => s.type))],
        coverage: {
          countries: ["US", "EU", "BR", "CN", "JP", "IN", "KR", "AU", "CA", "WHO"],
          data_sources: 22,
        },
      },
      updated_at: new Date().toISOString(),
      _links: {
        self: "https://orsd.contextual-intelligence.org/v1/stats",
        companies: "https://orsd.contextual-intelligence.org/v1/companies",
        signals: "https://orsd.contextual-intelligence.org/v1/signals",
        spec: "https://github.com/contextual-intelligence/orsd",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(503).json({ error: "database_unavailable", detail: message });
  }
});

export default router;
