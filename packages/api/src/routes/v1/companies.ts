/**
 * ORSD Companies Endpoint — adapted from monorepo platform/routes/orsd.ts
 *
 * GET /v1/companies — list all tracked companies with their signals.
 */

import { Router, type Request, type Response } from "express";
import { dgraph } from "../../services/dgraph.js";

const router = Router();

interface DgraphResult {
  queryCompany?: unknown[];
  [key: string]: unknown;
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await dgraph.query<DgraphResult>(
      `query {
        queryCompany {
          normalizedName
          name
          domain
          description
          segment
          region
          develops { name }
          hasSignal { type date }
        }
      }`,
    );

    res.json({
      data: result?.queryCompany ?? [],
      meta: {
        total: Array.isArray(result?.queryCompany) ? result.queryCompany.length : 0,
        version: "0.1",
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(503).json({ error: "database_unavailable", detail: message });
  }
});

export default router;
