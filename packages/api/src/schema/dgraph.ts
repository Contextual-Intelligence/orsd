/**
 * ORSD Dgraph Schema
 *
 * Defines Company, Product, Application, and Signal types.
 *
 * IMPORTANT: Signal.id uses String! @id (not ID!) so that we can
 * assign deterministic ORSD IDs (SHA-256 of source:externalId).
 * If ID! were used without @id, Dgraph would auto-generate UIDs
 * and our dedup would never match.
 */

export const ORSD_DGRAPH_SCHEMA = `
type Company {
  normalizedName: String! @id
  name: String! @search(by: [fulltext])
  domain: String
  description: String
  segment: String
  region: String
  tier: String
  totalScore: Float
  signalScore: Float
  supplies: [Product]
  develops: [Application]
  hasSignal: [Signal]
}

type Product {
  catalogId: String! @id
  name: String! @search(by: [fulltext])
  category: String
  usedIn: [Application]
}

type Application {
  name: String! @id
  category: String
}

type Signal {
  id: String! @id
  externalId: String! @search(by: [hash])
  source: String! @search(by: [hash])
  jurisdiction: String! @search(by: [hash])
  type: String! @search(by: [hash])
  title: String @search(by: [fulltext])
  date: String! @search(by: [exact])
  confidence: Float
  description: String
  url: String
  companyName: String @search(by: [fulltext])
  productName: String @search(by: [fulltext])
  productCode: String @search(by: [hash])
  metadata: [String!]
  ingestedAt: String @search(by: [exact])
}
`;
