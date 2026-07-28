/**
 * ORSD Signal Normalization
 *
 * Converts raw signals from any source into the canonical
 * NormalizedSignal shape. Assigns ORSD IDs, validates required
 * fields, and sets ingestion timestamps.
 */

import { createHash } from "node:crypto";
import type { RawSignal, NormalizedSignal } from "../types.js";

export function normalizeSignals(raw: RawSignal[]): NormalizedSignal[] {
  return raw.map(normalizeOne).filter((s): s is NormalizedSignal => s !== null);
}

function normalizeOne(raw: RawSignal): NormalizedSignal | null {
  // Validate required fields
  if (!raw.externalId || !raw.type || !raw.date) {
    return null;
  }

  // Generate deterministic ORSD ID from source + externalId
  // Full SHA-256 hex (no truncation) for true collision resistance.
  const id = createHash("sha256")
    .update(`${raw.source}:${raw.externalId}`)
    .digest("hex");

  return {
    id,
    externalId: raw.externalId,
    source: raw.source,
    jurisdiction: raw.jurisdiction,
    type: raw.type,
    title: raw.title || `${raw.type} — ${raw.jurisdiction}`,
    description: raw.description || "",
    date: raw.date,
    url: raw.url || "",
    companyName: raw.companyName,
    productName: raw.productName,
    productCode: raw.productCode,
    confidence: "medium", // will be refined by confidence scorer
    metadata: raw.metadata ?? {},
    ingestedAt: new Date().toISOString(),
  };
}
