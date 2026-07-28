/**
 * ORSD Signals Endpoint
 *
 * GET /v1/signals — list regulatory signals with all fields.
 * Query params: type (filter), source (filter), jurisdiction (filter),
 * limit (max 1000), offset.
 */

import { Router, type Request, type Response } from "express";
import { dgraph } from "../../services/dgraph.js";

const router = Router();

interface SignalResult {
  id: string;
  externalId?: string;
  source?: string;
  jurisdiction?: string;
  type: string;
  title?: string;
  date: string;
  confidence?: number;
  description?: string;
  url?: string;
  companyName?: string;
  productName?: string;
  productCode?: string;
  metadata?: string[];
  ingestedAt?: string;
}

interface DgraphResult {
  querySignal?: SignalResult[];
  [key: string]: unknown;
}

function buildFilterClause(params: Record<string, string | undefined>): string {
  const filters: string[] = [];
  if (params.type) filters.push(`type: { eq: "${params.type}" }`);
  if (params.source) filters.push(`source: { eq: "${params.source}" }`);
  if (params.jurisdiction) filters.push(`jurisdiction: { eq: "${params.jurisdiction}" }`);

  if (filters.length === 0) return "";
  if (filters.length === 1) return `filter: { ${filters[0]} } `;
  return `filter: { and: [ ${filters.join(" ")} ] } `;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    const sourceFilter = req.query.source as string | undefined;
    const jurisdictionFilter = req.query.jurisdiction as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const flt = buildFilterClause({ type: typeFilter, source: sourceFilter, jurisdiction: jurisdictionFilter });

    const result = await dgraph.query<DgraphResult>(
      `query {
        querySignal(${flt}first: ${limit}, offset: ${offset}) {
          id
          externalId
          source
          jurisdiction
          type
          title
          date
          confidence
          description
          url
          companyName
          productName
          productCode
          metadata
          ingestedAt
        }
      }`,
    );

    const signals = result?.querySignal ?? [];

    res.json({
      data: signals,
      meta: {
        total: signals.length,
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
