/**
 * EUR-Lex Automated Discovery Module
 *
 * Scans EUR-Lex SPARQL for new EU legislative acts relevant to digital
 * regulation, using a watermark-based incremental strategy:
 *
 *   1. Batch refresh: verify all known CELEX IDs from the curated registry
 *      via a single SPARQL query (STR() IN (...) to handle typed literals).
 *   2. Incremental scan: enumerate regulations/directives for the current
 *      year that are newer than the last watermark, with in-query keyword
 *      pre-filtering to avoid fetching 1,400+ titles.
 *   3. Relevance scoring: candidates matching digital-strategy keywords
 *      (cyber, AI, data, digital, platform, etc.) get a high score and
 *      are auto-promoted to signals; medium-score candidates go to a
 *      review queue for human-in-loop promotion.
 *
 * Watermark state is persisted to a JSON file so subsequent runs only
 * fetch new acts.
 *
 * Usage:
 *   npx tsx packages/crawler/src/sources/eu-legislation/discover.ts
 *   npx tsx packages/crawler/src/sources/eu-legislation/discover.ts --dry-run
 *   npx tsx packages/crawler/src/sources/eu-legislation/discover.ts --year 2025
 */

import { EU_ACTS, type EuAct } from "./registry.js";

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
const SPARQL_TIMEOUT_MS = 30_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiscoveredAct {
  celex: string;
  title: string | null;
  actType: "regulation" | "directive" | "decision" | "unknown";
  dateSignature: string | null;
  dateEntryIntoForce: string | null;
  relevanceScore: number;
  matchedKeywords: string[];
  isProposal: boolean;
}

export interface DiscoveryWatermark {
  lastRun: string;
  lastCelexSeen: string | null;
  yearsScanned: number[];
  totalDiscovered: number;
  totalPromoted: number;
  candidatesPendingReview: number;
}

export interface DiscoveryResult {
  refreshed: Array<{ celex: string; title: string | null; found: boolean }>;
  discovered: DiscoveredAct[];
  promoted: DiscoveredAct[];
  reviewQueue: DiscoveredAct[];
  watermark: DiscoveryWatermark;
  errors: string[];
}

// ─── Keywords for relevance scoring ─────────────────────────────────────────

const RELEVANCE_KEYWORDS: Array<{ keyword: string; weight: number }> = [
  { keyword: "cyber", weight: 10 },
  { keyword: "artificial intelligence", weight: 10 },
  { keyword: " ai ", weight: 8 },
  { keyword: "data", weight: 8 },
  { keyword: "digital", weight: 8 },
  { keyword: "platform", weight: 7 },
  { keyword: "privacy", weight: 7 },
  { keyword: "gdpr", weight: 7 },
  { keyword: "electronic", weight: 6 },
  { keyword: "trust", weight: 5 },
  { keyword: "interoperab", weight: 5 },
  { keyword: "chip", weight: 5 },
  { keyword: "crypto", weight: 5 },
  { keyword: "machine", weight: 4 },
  { keyword: "product", weight: 4 },
  { keyword: "liability", weight: 4 },
  { keyword: "health", weight: 4 },
  { keyword: "raw material", weight: 4 },
  { keyword: "net-zero", weight: 4 },
  { keyword: "sustainab", weight: 3 },
  { keyword: "market", weight: 3 },
  { keyword: "consumer", weight: 3 },
  { keyword: "transparen", weight: 3 },
];

const AUTO_PROMOTE_THRESHOLD = 15;
const REVIEW_THRESHOLD = 5;

// ─── SPARQL helpers ──────────────────────────────────────────────────────────

interface SparqlBinding {
  type?: string;
  value?: string;
  datatype?: string;
}

interface SparqlResult {
  head?: { vars?: string[] };
  results?: { bindings?: Array<Record<string, SparqlBinding>> };
}

async function sparqlQuery(query: string, userAgent: string): Promise<SparqlResult> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "User-Agent": userAgent,
    },
    body: new URLSearchParams({ query }),
    signal: AbortSignal.timeout(SPARQL_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`SPARQL query failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SparqlResult;
}

// ─── Batch refresh: verify all known CELEX IDs in one query ──────────────────

export async function refreshKnownActs(
  userAgent: string,
): Promise<Array<{ celex: string; title: string | null; found: boolean }>> {
  const knownCelexes = EU_ACTS.map((a) => a.celex);
  const chunks: string[][] = [];
  for (let i = 0; i < knownCelexes.length; i += 10) {
    chunks.push(knownCelexes.slice(i, i + 10));
  }

  const results: Array<{ celex: string; title: string | null; found: boolean }> = [];

  for (const chunk of chunks) {
    const values = chunk.map((c) => `"${c}"`).join(" ");
    const query = [
      "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>",
      "SELECT ?celex ?title WHERE {",
      `  VALUES ?celexStr { ${values} }`,
      "  ?work cdm:resource_legal_id_celex ?celex .",
      "  FILTER(STR(?celex) = ?celexStr)",
      "  OPTIONAL { ?work cdm:work_title ?title }",
      "}",
    ].join("\n");

    const data = await sparqlQuery(query, userAgent);
    const found = new Map<string, string | null>();

    for (const b of data.results?.bindings ?? []) {
      const celex = b.celex?.value;
      if (!celex) continue;
      const title = b.title?.value ?? null;
      // Reject proposal stubs
      if (title && /^proposal for a /i.test(title)) {
        found.set(celex, null);
      } else if (!found.has(celex)) {
        found.set(celex, title ?? null);
      }
    }

    for (const celex of chunk) {
      results.push({
        celex,
        title: found.get(celex) ?? null,
        found: found.has(celex),
      });
    }
  }

  return results;
}

// ─── Incremental scan: discover new acts for a year ──────────────────────────

export async function discoverNewActs(
  year: number,
  userAgent: string,
  keywords?: string[],
): Promise<DiscoveredAct[]> {
  // Use in-query keyword filtering to avoid fetching all 1,400+ titles.
  // If keywords are provided, only acts whose title contains at least one
  // keyword are returned. Otherwise, all acts for the year are returned.
  const keywordFilters =
    keywords && keywords.length > 0
      ? keywords
          .map((k) => `FILTER(CONTAINS(LCASE(STR(?title)), "${k.toLowerCase()}"))`)
          .join("\n          ")
      : "";

  const query = [
    "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>",
    "SELECT ?celex ?title ?dateSig ?dateEntry WHERE {",
    "  ?work cdm:resource_legal_id_celex ?celex .",
    "  ?work cdm:resource_legal_date_signature ?dateSig .",
    "  FILTER(STRSTARTS(STR(?celex), \"3" + year + "\"))",
    "  OPTIONAL { ?work cdm:work_title ?title }",
    "  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?dateEntry }",
    keywordFilters ? `  ${keywordFilters}` : "",
    "}",
    "ORDER BY ?celex",
  ]
    .filter(Boolean)
    .join("\n");

  const data = await sparqlQuery(query, userAgent);
  const acts: DiscoveredAct[] = [];
  const seen = new Set<string>();

  for (const b of data.results?.bindings ?? []) {
    const celex = b.celex?.value;
    if (!celex || seen.has(celex)) continue;
    seen.add(celex);

    const title = b.title?.value ?? null;
    const dateSig = b.dateSig?.value ?? null;
    const dateEntry = b.dateEntry?.value ?? null;

    // Skip proposals
    const isProposal = title ? /^proposal for a /i.test(title) : false;

    // Determine act type from CELEX
    const actType: DiscoveredAct["actType"] = celex.match(/^3\d{4}R/)
      ? "regulation"
      : celex.match(/^3\d{4}L/)
        ? "directive"
        : celex.match(/^3\d{4}D/)
          ? "decision"
          : "unknown";

    // Score relevance
    const titleLower = (title ?? "").toLowerCase();
    const matchedKeywords: string[] = [];
    let relevanceScore = 0;
    for (const { keyword, weight } of RELEVANCE_KEYWORDS) {
      if (titleLower.includes(keyword)) {
        relevanceScore += weight;
        matchedKeywords.push(keyword.trim());
      }
    }

    // Already in registry? Skip (it's not "new")
    if (EU_ACTS.some((a) => a.celex === celex)) continue;

    acts.push({
      celex,
      title,
      actType,
      dateSignature: dateSig,
      dateEntryIntoForce: dateEntry,
      relevanceScore,
      matchedKeywords,
      isProposal,
    });
  }

  return acts;
}

// ─── Relevance classification ────────────────────────────────────────────────

export function classifyAct(act: DiscoveredAct): "promoted" | "review" | "rejected" {
  if (act.isProposal) return "rejected";
  if (act.relevanceScore >= AUTO_PROMOTE_THRESHOLD) return "promoted";
  if (act.relevanceScore >= REVIEW_THRESHOLD) return "review";
  return "rejected";
}

// ─── Watermark persistence ───────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WATERMARK_PATH = join(__dirname, "..", "..", "..", "..", "data", "eu-legislation-watermark.json");

export function loadWatermark(): DiscoveryWatermark | null {
  try {
    if (!existsSync(WATERMARK_PATH)) return null;
    const raw = readFileSync(WATERMARK_PATH, "utf-8");
    return JSON.parse(raw) as DiscoveryWatermark;
  } catch {
    return null;
  }
}

export function saveWatermark(wm: DiscoveryWatermark): void {
  try {
    writeFileSync(WATERMARK_PATH, JSON.stringify(wm, null, 2));
  } catch (err) {
    console.error("Failed to save watermark:", err);
  }
}

// ─── Main discovery run ──────────────────────────────────────────────────────

export async function runDiscovery(
  userAgent: string,
  options: { dryRun?: boolean; year?: number } = {},
): Promise<DiscoveryResult> {
  const errors: string[] = [];
  const year = options.year ?? new Date().getFullYear();

  // 1. Batch refresh known acts
  let refreshed: Array<{ celex: string; title: string | null; found: boolean }> = [];
  try {
    refreshed = await refreshKnownActs(userAgent);
  } catch (err) {
    errors.push(`refreshKnownActs: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Discover new acts for the target year (and previous year if no watermark)
  const wm = loadWatermark();
  const yearsToScan = wm?.yearsScanned.includes(year)
    ? [year] // Already scanned this year — just check for new entries
    : [year, year - 1];

  const discovered: DiscoveredAct[] = [];
  for (const y of yearsToScan) {
    try {
      const acts = await discoverNewActs(y, userAgent);
      discovered.push(...acts);
    } catch (err) {
      errors.push(`discoverNewActs(${y}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. Classify: promote / review / reject
  const promoted: DiscoveredAct[] = [];
  const reviewQueue: DiscoveredAct[] = [];
  for (const act of discovered) {
    const cls = classifyAct(act);
    if (cls === "promoted") promoted.push(act);
    else if (cls === "review") reviewQueue.push(act);
  }

  // 4. Update watermark
  const watermark: DiscoveryWatermark = {
    lastRun: new Date().toISOString(),
    lastCelexSeen: discovered.length > 0 ? discovered[discovered.length - 1].celex : wm?.lastCelexSeen ?? null,
    yearsScanned: [...new Set([...(wm?.yearsScanned ?? []), ...yearsToScan])],
    totalDiscovered: (wm?.totalDiscovered ?? 0) + discovered.length,
    totalPromoted: (wm?.totalPromoted ?? 0) + promoted.length,
    candidatesPendingReview: reviewQueue.length,
  };

  if (!options.dryRun) {
    saveWatermark(watermark);
  }

  return { refreshed, discovered, promoted, reviewQueue, watermark, errors };
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const yearArg = args.indexOf("--year");
  const year = yearArg >= 0 ? parseInt(args[yearArg + 1], 10) : undefined;
  const userAgent = "ORSD-Discovery/1.0";

  console.log("EUR-Lex Discovery starting", { dryRun, year: year ?? new Date().getFullYear() });

  const result = await runDiscovery(userAgent, { dryRun, year });

  console.log("\n=== Batch Refresh ===");
  const found = result.refreshed.filter((r) => r.found).length;
  const notFound = result.refreshed.filter((r) => !r.found).length;
  console.log(`Known acts: ${found} found, ${notFound} not found in SPARQL`);
  for (const r of result.refreshed.filter((r) => r.found && r.title)) {
    console.log(`  ✓ ${r.celex}: ${r.title?.substring(0, 80)}…`);
  }

  console.log(`\n=== Discovery ===`);
  console.log(`Total discovered: ${result.discovered.length}`);
  console.log(`Auto-promoted (score ≥ ${AUTO_PROMOTE_THRESHOLD}): ${result.promoted.length}`);
  console.log(`Review queue (score ≥ ${REVIEW_THRESHOLD}): ${result.reviewQueue.length}`);

  if (result.promoted.length > 0) {
    console.log("\n--- Promoted (high confidence) ---");
    for (const a of result.promoted) {
      console.log(`  [${a.relevanceScore}] ${a.celex} (${a.actType}): ${a.title?.substring(0, 80) ?? "(no title)"}`);
      console.log(`       keywords: ${a.matchedKeywords.join(", ")}`);
    }
  }

  if (result.reviewQueue.length > 0) {
    console.log("\n--- Review Queue (medium confidence) ---");
    for (const a of result.reviewQueue) {
      console.log(`  [${a.relevanceScore}] ${a.celex} (${a.actType}): ${a.title?.substring(0, 80) ?? "(no title)"}`);
    }
  }

  console.log(`\n=== Watermark ===`);
  console.log(JSON.stringify(result.watermark, null, 2));

  if (result.errors.length > 0) {
    console.log(`\n=== Errors (${result.errors.length}) ===`);
    for (const e of result.errors) console.log(`  ! ${e}`);
  }

  console.log("\nDone.");
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Discovery failed:", err);
    process.exit(1);
  });
}

export { RELEVANCE_KEYWORDS, AUTO_PROMOTE_THRESHOLD, REVIEW_THRESHOLD, WATERMARK_PATH };
