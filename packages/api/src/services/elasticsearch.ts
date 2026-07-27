/**
 * Elasticsearch Signal Index — extracted from monorepo platform/services/signal-index.ts
 *
 * Multi-lingual index for regulatory signals with field mappings
 * optimized for regulatory text search across jurisdictions.
 */

export const SIGNALS_INDEX = "signals";

export interface IndexDefinition {
  name: string;
  settings: Record<string, unknown>;
  mappings: {
    properties: Record<string, unknown>;
  };
  aliases?: Record<string, Record<string, unknown>>;
}

export const MULTI_LINGUAL_ANALYZERS = {
  analysis: {
    analyzer: {
      default: { type: "standard" },
    },
  },
};

export const SIGNAL_INDEX_DEFINITION: IndexDefinition = {
  name: SIGNALS_INDEX,
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    ...MULTI_LINGUAL_ANALYZERS,
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      source: { type: "keyword" },
      jurisdiction: { type: "keyword" },
      type: { type: "keyword" },
      title: {
        type: "text",
        fields: {
          english: { analyzer: "english", type: "text" },
          german: { analyzer: "german", type: "text" },
          french: { analyzer: "french", type: "text" },
          spanish: { analyzer: "spanish", type: "text" },
          italian: { analyzer: "italian", type: "text" },
          portuguese: { analyzer: "portuguese", type: "text" },
        },
      },
      description: {
        type: "text",
        fields: {
          english: { analyzer: "english", type: "text" },
          german: { analyzer: "german", type: "text" },
          french: { analyzer: "french", type: "text" },
        },
      },
      date: { type: "date" },
      confidence: { type: "float" },
      url: { type: "keyword" },
      companyName: { type: "text" },
      productName: { type: "text" },
      productCode: { type: "keyword" },
      metadata: {
        properties: {
          regulatoryProcess: { type: "keyword" },
          classification: { type: "keyword" },
          holder: { type: "text" },
          status: { type: "keyword" },
          submissionDate: { type: "date" },
          deviceIdentifier: { type: "keyword" },
          manufacturer: { type: "text" },
          approvalNumber: { type: "keyword" },
        },
      },
    },
  },
  aliases: {
    signals_current: {},
  },
};
