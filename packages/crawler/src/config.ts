/**
 * ORSD Crawler Configuration
 *
 * Environment-driven config for all source connectors.
 */

export interface CrawlerConfig {
  /** Dgraph GraphQL endpoint for writing ingested signals */
  dgraphUrl: string;
  /** Elasticsearch endpoint for signal indexing */
  elasticsearchUrl: string;
  /** Per-source fetch interval in hours (default: 24) */
  defaultIntervalHours: number;
  /** Maximum signals to ingest per source per run (safety limit) */
  maxSignalsPerSource: number;
  /** User-agent for HTTP requests */
  userAgent: string;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(): CrawlerConfig {
  return {
    dgraphUrl: envStr("DGRAPH_URL", "http://localhost:8080"),
    elasticsearchUrl: envStr("ELASTICSEARCH_URL", "http://localhost:9200"),
    defaultIntervalHours: envInt("CRAWL_INTERVAL_HOURS", 24),
    maxSignalsPerSource: envInt("MAX_SIGNALS_PER_SOURCE", 5000),
    userAgent: envStr("ORSD_USER_AGENT", "ORSD-Crawler/0.1"),
  };
}
