/**
 * ORSD Crawler — Core Data Types
 *
 * These define the canonical signal shape that all sources normalize into.
 */

/** Jurisdictions covered by ORSD */
export type Jurisdiction =
  | "US"
  | "EU"
  | "BR"
  | "CN"
  | "JP"
  | "IN"
  | "KR"
  | "AU"
  | "CA"
  | "WHO";

/** Regulatory signal types */
export type SignalType =
  | "FDA_CLEARANCE"
  | "FDA_510K"
  | "FDA_PMA"
  | "FDA_DE_NOVO"
  | "FDA_CLIA_WAIVER"
  | "EUDAMED_CERTIFICATE"
  | "EUDAMED_CLINICAL_INVESTIGATION"
  | "ANVISA_REGISTRATION"
  | "PMDA_APPROVAL"
  | "CDSCO_REGISTRATION"
  | "NMPA_APPROVAL"
  | "TGA_REGISTRATION"
  | "HEALTH_CANADA_LICENSE"
  | "MFDS_APPROVAL"
  | "WHO_PQ"
  | "CLINICAL_TRIAL"
  | "MARKET_NEWS"
  | "REGULATORY_UPDATE";

/** Confidence level assigned to a signal */
export type Confidence = "high" | "medium" | "low";

/** Raw signal as ingested from any source */
export interface RawSignal {
  /** Source-provided identifier */
  externalId: string;
  /** Which source system this came from */
  source: string;
  /** The jurisdiction the regulatory action occurred in */
  jurisdiction: Jurisdiction;
  /** Normalized signal type */
  type: SignalType;
  /** Title / headline */
  title: string;
  /** Detailed description */
  description: string;
  /** Date of the regulatory action */
  date: string;
  /** Direct URL to the source record */
  url: string;
  /** Company or organization name referenced in the signal */
  companyName?: string;
  /** Product or device name, if applicable */
  productName?: string;
  /** Product classification code (e.g. FDA product code) */
  productCode?: string;
  /** Any source-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Normalized signal ready for storage */
export interface NormalizedSignal {
  /** ORSD-generated unique ID (hash of source + externalId) */
  id: string;
  /** Same as RawSignal fields */
  externalId: string;
  source: string;
  jurisdiction: Jurisdiction;
  type: SignalType;
  title: string;
  description: string;
  date: string;
  url: string;
  companyName?: string;
  productName?: string;
  productCode?: string;
  /** Confidence score after dedup and enrichment */
  confidence: Confidence;
  /** Additional metadata after enrichment */
  metadata: Record<string, unknown>;
  /** ISO timestamp when this signal was ingested */
  ingestedAt: string;
}

/** Result of a single source crawl */
export interface CrawlResult {
  source: string;
  jurisdiction: Jurisdiction;
  fetched: number;
  normalized: number;
  deduplicated: number;
  ingested: number;
  errors: string[];
  durationMs: number;
}
