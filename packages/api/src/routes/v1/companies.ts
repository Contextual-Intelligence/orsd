/**
 * ORSD Companies Endpoint
 *
 * GET /v1/companies — list all tracked companies with their signals.
 * Query params: segment (filter), region (filter), limit (max 1000), offset.
 */

import { Router, type Request, type Response } from "express";
import { dgraph } from "../../services/dgraph.js";

const router = Router();

/** Only allow alphanumeric, underscores, and hyphens. */
const SAFE_STRING = /^[a-zA-Z0-9_-]+$/;

interface DgraphResult {
  queryCompany?: unknown[];
  [key: string]: unknown;
}

function validateFilter(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!SAFE_STRING.test(trimmed)) return undefined;
  return trimmed;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const segmentFilter = validateFilter(req.query.segment as string | undefined);
    const regionFilter = validateFilter(req.query.region as string | undefined);

    if ((req.query.segment && !segmentFilter) || (req.query.region && !regionFilter)) {
      res.status(400).json({
        error: "invalid_filter",
        message: "Filter values must be alphanumeric (underscores/hyphens allowed).",
      });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const filters: string[] = [];
    if (segmentFilter) filters.push(`segment: { eq: "${segmentFilter}" }`);
    if (regionFilter) filters.push(`region: { eq: "${regionFilter}" }`);

    const flt = filters.length > 0
      ? `filter: { ${filters.length === 1 ? filters[0] : `and: [${filters.join(" ")}]`} } `
      : "";

    const result = await dgraph.query<DgraphResult>(
      `query {
        queryCompany(${flt}first: ${limit}, offset: ${offset}) {
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
