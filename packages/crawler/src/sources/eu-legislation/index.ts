/**
 * EU Legislation Source Connector
 *
 * Tracks EU digital-strategy legislation (Cyber Resilience Act, AI Act,
 * Data Act, NIS2, GDPR, …) as REGULATORY_UPDATE signals with jurisdiction EU.
 *
 * Strategy (extract-and-serve, graceful degradation):
 *   1. Curated registry (registry.ts) is the deterministic base — every act
 *      always yields a signal with official CELEX metadata.
 *   2. EUR-Lex SPARQL endpoint is queried per act to enrich/confirm status
 *      and dates when reachable. Failures degrade silently to the registry.
 *
 * Reference: https://digital-strategy.ec.europa.eu/en/library/cyber-resilience-act
 */

import type { SourceConnector } from "../index.js"
import type { RawSignal } from "../../types.js"
import type { CrawlerConfig } from "../../config.js"
import { EU_ACTS, findAct, type EuAct } from "./registry.js"

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql"
const SPARQL_TIMEOUT_MS = 15_000

interface SparqlBinding {
  type?: string
  value?: string
  datatype?: string
}

interface SparqlResult {
  head?: { vars?: string[] }
  results?: { bindings?: Array<Record<string, SparqlBinding>> }
}

/** Query EUR-Lex SPARQL for an act's official title. Returns null on failure. */
async function fetchOfficialTitle(config: CrawlerConfig, celex: string): Promise<string | null> {
  try {
    const query = [
      "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>",
      `SELECT ?t WHERE { ?s cdm:resource_legal_id_celex ?v . FILTER(STR(?v) = "${celex}") . ?s cdm:work_title ?t } LIMIT 1`,
    ].join(" ")

    const res = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/sparql-results+json",
        "User-Agent": config.userAgent,
      },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(SPARQL_TIMEOUT_MS),
    })

    if (!res.ok) return null

    const data = (await res.json()) as SparqlResult
    const title = data.results?.bindings?.[0]?.t?.value
    if (!title || title.length === 0) return null

    // EUR-Lex SPARQL can resolve a CELEX to the pre-legislative proposal
    // work (e.g. "Proposal for a REGULATION …"). The adopted act has the
    // same CELEX but its title is what we want — never override the curated
    // title with a proposal stub.
    if (/^proposal for a /i.test(title)) return null
    return title
  } catch {
    return null
  }
}

/** Build a RawSignal from a registry entry, optionally enriched with the official EUR-Lex title. */
function toSignal(act: EuAct, officialTitle: string | null): RawSignal {
  const title = officialTitle ?? act.title
  return {
    externalId: `eu-${act.celex}`,
    source: "eu-legislation",
    jurisdiction: "EU",
    type: "REGULATORY_UPDATE",
    title: `${act.shortName} — ${act.status === "in-force" ? "in force" : act.status === "applying" ? "applies" : "adopted"}`,
    description: `${title}. Adoption: ${act.adoptionDate}. Entry into force: ${act.entryIntoForce}. Applies from: ${act.applicationDate}.`,
    date: act.applicationDate || act.entryIntoForce || act.adoptionDate,
    url: act.eurlexUrl,
    metadata: {
      celex: act.celex,
      actType: act.actType,
      status: act.status,
      adoptionDate: act.adoptionDate,
      entryIntoForce: act.entryIntoForce,
      applicationDate: act.applicationDate,
      shortName: act.shortName,
      digitalStrategyUrl: act.digitalStrategyUrl ?? null,
      officialTitle: officialTitle ?? null,
    },
  }
}

export class EuLegislationSource implements SourceConnector {
  name = "eu-legislation"
  jurisdiction = "EU" as const

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = []

    // Enrich in bounded fashion: at most one SPARQL call per act, sequential.
    for (const act of EU_ACTS) {
      const officialTitle = await fetchOfficialTitle(config, act.celex)
      signals.push(toSignal(act, officialTitle))
    }

    return signals
  }
}

/** Convenience export for tests/tooling. */
export { EU_ACTS, findAct }
