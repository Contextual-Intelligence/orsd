/**
 * ORSD Signals Endpoint
 *
 * GET /v1/signals — list regulatory signals with all fields.
 * Query params: type, source, jurisdiction (filter), limit (max 1000), offset.
 *
 * All string params are validated against a safe pattern to prevent
 * GraphQL injection through the filter clause.
 */

import { Router, type Request, type Response } from "express";
import { dgraph } from "../../services/dgraph.js";

const router = Router();

/** Only allow alphanumeric, underscores, and hyphens in filter values. */
const SAFE_STRING = /^[a-zA-Z0-9_-]+$/;

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

/** Known valid values for enum-like filters (allow-listed or use SAFE_STRING). */
const KNOWN_SOURCES = [
  "fda", "clinicaltrials", "eudamed", "anvisa", "pmda", "cdsco",
  "nmpa", "tga", "health_canada", "mfds", "who", "eu-legislation",
] as const;

const KNOWN_JURISDICTIONS = ["US", "EU", "BR", "CN", "JP", "IN", "KR", "AU", "CA", "WHO"] as const;

function validateFilter(value: string | undefined, allowList?: readonly string[]): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  // Must match safe pattern
  if (!SAFE_STRING.test(trimmed)) return undefined;
  // If an allow-list is given, check membership
  if (allowList && !(allowList as readonly string[]).includes(trimmed)) return undefined;
  return trimmed;
}

interface FilterParams {
  type?: string;
  source?: string;
  jurisdiction?: string;
}

function buildFilterClause(params: FilterParams): string {
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
    // Validate and sanitize filter params
    const typeFilter = validateFilter(req.query.type as string | undefined);
    const sourceFilter = validateFilter(req.query.source as string | undefined, KNOWN_SOURCES as unknown as string[]);
    const jurisdictionFilter = validateFilter(req.query.jurisdiction as string | undefined, KNOWN_JURISDICTIONS as unknown as string[]);

    // Reject invalid query params with a clear error
    if (
      (req.query.type && !typeFilter) ||
      (req.query.source && !sourceFilter) ||
      (req.query.jurisdiction && !jurisdictionFilter)
    ) {
      res.status(400).json({
        error: "invalid_filter",
        message: "Filter values must be alphanumeric (underscores/hyphens allowed). " +
          "source must be one of: fda, clinicaltrials, eudamed, anvisa, pmda, cdsco, " +
          "nmpa, tga, health_canada, mfds, who, eu-legislation. " +
          "jurisdiction must be one of: US, EU, BR, CN, JP, IN, KR, AU, CA, WHO.",
      });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

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
