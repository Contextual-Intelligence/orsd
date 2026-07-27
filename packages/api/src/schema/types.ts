/**
 * ORSD API — Response & Query Types
 */

export interface ApiResponse<T> {
  data: T;
  meta: {
    total: number;
    version: string;
    updated_at: string;
  };
}

export interface StatsResponse {
  name: string;
  version: string;
  license: string;
  attribution: string;
  source_licenses: string;
  stats: {
    companies: number;
    signals: number;
    signal_types: string[];
    coverage: {
      countries: string[];
      data_sources: number;
    };
  };
  updated_at: string;
  _links: Record<string, string>;
}
