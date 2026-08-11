/**
 * ORSD Source Registry
 *
 * All registered source connectors. Add new sources here.
 */

import type { CrawlerConfig } from "../config.js";
import type { RawSignal } from "../types.js";
import { FdaSource } from "./fda/index.js";
import { EudamedSource } from "./eudamed/index.js";
import { AnvisaSource } from "./anvisa/index.js";
import { PmdaSource } from "./pmda/index.js";
import { CdscoSource } from "./cdsco/index.js";
import { NmpaSource } from "./nmpa/index.js";
import { TgaSource } from "./tga/index.js";
import { HealthCanadaSource } from "./health-canada/index.js";
import { MfdsSource } from "./mfds/index.js";
import { WhoSource } from "./who/index.js";
import { ClinicalTrialsSource } from "./clinical-trials/index.js";
import { EuLegislationSource } from "./eu-legislation/index.js";

export interface SourceConnector {
  /** Unique source identifier (e.g. "fda", "eudamed") */
  name: string;
  /** Primary jurisdiction */
  jurisdiction: RawSignal["jurisdiction"];
  /** Fetch signals from this source */
  fetch(config: CrawlerConfig): Promise<RawSignal[]>;
}

const REGISTERED_SOURCES: SourceConnector[] = [
  new FdaSource(),
  new EudamedSource(),
  new AnvisaSource(),
  new PmdaSource(),
  new CdscoSource(),
  new NmpaSource(),
  new TgaSource(),
  new HealthCanadaSource(),
  new MfdsSource(),
  new WhoSource(),
  new ClinicalTrialsSource(),
  new EuLegislationSource(),
];

/** Returns all registered source connectors */
export function getAllSources(): SourceConnector[] {
  return REGISTERED_SOURCES;
}

/** Get a single source by name */
export function getSource(name: string): SourceConnector | undefined {
  return REGISTERED_SOURCES.find((s) => s.name === name);
}
