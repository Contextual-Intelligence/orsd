/**
 * ORSD Dgraph Schema — extracted from monorepo leads/dgraph/schema.ts
 *
 * This is the canonical data model for the Open Regulatory Signal Dataset.
 * It defines Company, Product, Application, and Signal types stored in Dgraph.
 *
 * Note: This schema is the ORSD-owned copy. The monorepo previously used a
 * shared copy in the Leads app. Over time, the Leads schema may diverge.
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
  id: ID!
  type: String! @search(by: [hash])
  date: String! @search(by: [exact])
  confidence: Float
  description: String
  url: String
}
`;
