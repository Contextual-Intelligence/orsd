/**
 * ORSD Signal Types — extracted from monorepo platform/services/signal-index.ts
 *
 * Core signal shapes used by the API and search indexing.
 */

export interface SignalDocument {
  id: string;
  source: string;
  jurisdiction: string;
  type: string;
  title: string;
  description: string;
  date: string;
  confidence: number;
  url: string;
  companyName?: string;
  productName?: string;
  productCode?: string;
  metadata: Record<string, unknown>;
}

export interface CompanyDocument {
  normalizedName: string;
  name: string;
  domain?: string;
  description?: string;
  segment?: string;
  region?: string;
  totalScore?: number;
  hasSignal?: Array<{ type: string; date: string }>;
  develops?: Array<{ name: string; category?: string }>;
}
