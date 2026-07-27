/**
 * ORSD Signals Endpoint — adapted from monorepo platform/routes/orsd.ts
 *
 * GET /v1/signals — list regulatory signals.
 * Query params: type (filter), limit (max 1000), offset.
 */

import { Router, type Request, type Response } from "express";
import { dgraph } from "../../services/dgraph.js";

const router = Router();

interface DgraphResult {
  querySignal?: unknown[];
  [key: string]: unknown;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const flt = typeFilter ? `filter: { type: { eq: "${typeFilter}"} } ` : "";

    const result = await dgraph.query<DgraphResult>(
      `query {
        querySignal(${flt}first: ${limit}, offset: ${offset}) {
          type
          date
          confidence
          description
          url
        }
      }`,
    );

    res.json({
      data: result?.querySignal ?? [],
      meta: {
        total: Array.isArray(result?.querySignal) ? result.querySignal.length : 0,
        limit,
        offset,
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
