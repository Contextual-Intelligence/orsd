/**
 * ClinicalTrials.gov Connector
 *
 * Fetches interventional clinical study records from the
 * ClinicalTrials.gov API v2. Focuses on device and diagnostic trials.
 */

import type { SourceConnector } from "../index.js";
import type { RawSignal } from "../../types.js";
import type { CrawlerConfig } from "../../config.js";

const BASE_URL = "https://clinicaltrials.gov/api/v2/studies";

interface CtStudy {
  protocolSection: {
    identificationModule: {
      nctId: string;
      briefTitle: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date: string };
      primaryCompletionDateStruct?: { date: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
    conditionsModule?: {
      conditions?: string[];
    };
    designModule?: {
      phases?: string[];
    };
    armsInterventionsModule?: {
      interventions?: Array<{ name?: string; type?: string }>;
    };
  };
  hasResults?: boolean;
}

interface CtApiResponse {
  studies: CtStudy[];
  nextPageToken?: string;
  totalCount?: number;
}

export class ClinicalTrialsSource implements SourceConnector {
  name = "clinicaltrials";
  jurisdiction = "US" as const;

  async fetch(config: CrawlerConfig): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    let pageToken: string | undefined;

    const params: Record<string, string> = {
      format: "json",
      pageSize: "100",
      filter: "AREA[StudyType]INTERVENTIONAL",
      sort: "LastUpdatePostDate",
    };

    do {
      const qs = new URLSearchParams(params);
      if (pageToken) qs.set("pageToken", pageToken);

      const url = `${BASE_URL}?${qs}`;
      const res = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`ClinicalTrials.gov API error: ${res.status}`);

      const data = (await res.json()) as CtApiResponse;
      pageToken = data.nextPageToken;

      for (const study of data.studies ?? []) {
        const m = study.protocolSection;
        const id = m.identificationModule;
        const status = study.protocolSection.statusModule;
        const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor;

        const startDate = status?.startDateStruct?.date;
        const completionDate = status?.primaryCompletionDateStruct?.date;

        signals.push({
          externalId: `ct-${id.nctId}`,
          source: "clinicaltrials",
          jurisdiction: "US",
          type: "CLINICAL_TRIAL",
          title: id.briefTitle || id.officialTitle || `Clinical Trial ${id.nctId}`,
          description: `Study ${id.nctId}: ${id.officialTitle ?? id.briefTitle}. Sponsor: ${sponsor?.name ?? "Unknown"}. Status: ${status?.overallStatus ?? "Unknown"}.`,
          date: completionDate ?? startDate ?? "",
          url: `https://clinicaltrials.gov/study/${id.nctId}`,
          companyName: sponsor?.name,
          productName: study.protocolSection.armsInterventionsModule?.interventions?.[0]?.name,
          productCode: study.protocolSection.armsInterventionsModule?.interventions?.[0]?.type,
          metadata: {
            nctId: id.nctId,
            overallStatus: status?.overallStatus,
            phases: study.protocolSection.designModule?.phases,
            conditions: study.protocolSection.conditionsModule?.conditions,
            hasResults: study.hasResults,
          },
        });
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 300));
    } while (pageToken && signals.length < config.maxSignalsPerSource);

    return signals;
  }
}
