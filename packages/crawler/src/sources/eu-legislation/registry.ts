/**
 * EU Digital-Strategy Acts Registry
 *
 * Curated registry of EU legislative acts relevant to digital products
 * (cybersecurity, AI, data, platforms, machinery). Each act carries its
 * official CELEX identifier (EUR-Lex), title, status, and key dates.
 *
 * Source of truth: EUR-Lex (https://eur-lex.europa.eu) and the European
 * Commission Digital Strategy library (https://digital-strategy.ec.europa.eu).
 *
 * This registry is the deterministic base for the `eu-legislation` source.
 * The connector enriches entries with live status from EUR-Lex SPARQL when
 * reachable, and degrades gracefully to this curated data otherwise.
 */

export interface EuAct {
  /** Official CELEX identifier (e.g. 32024R2847 for the Cyber Resilience Act) */
  celex: string
  /** Short common name */
  shortName: string
  /** Full official title */
  title: string
  /** Act type (regulation / directive / decision) */
  actType: "regulation" | "directive" | "decision"
  /** Legislative status as of the registry snapshot */
  status: "in-force" | "adopted" | "applying"
  /** Date of adoption (YYYY-MM-DD) */
  adoptionDate: string
  /** Date of entry into force (YYYY-MM-DD) */
  entryIntoForce: string
  /** Date from which it applies / obligations start (YYYY-MM-DD) */
  applicationDate: string
  /** EUR-Lex document URL */
  eurlexUrl: string
  /** European Commission digital-strategy library page (where available) */
  digitalStrategyUrl?: string
}

export const EU_ACTS: EuAct[] = [
  {
    celex: "32024R2847",
    shortName: "Cyber Resilience Act (CRA)",
    title: "Regulation (EU) 2024/2847 on horizontal cybersecurity requirements for products with digital elements",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2024-10-23",
    entryIntoForce: "2024-12-10",
    applicationDate: "2026-12-11",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2024/2847/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/library/cyber-resilience-act",
  },
  {
    celex: "32024R1689",
    shortName: "AI Act",
    title: "Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2024-06-13",
    entryIntoForce: "2024-08-01",
    applicationDate: "2026-08-02",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
  },
  {
    celex: "32023R2854",
    shortName: "Data Act",
    title: "Regulation (EU) 2023/2854 on harmonised rules on fair access to and use of data",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2023-12-13",
    entryIntoForce: "2024-01-11",
    applicationDate: "2025-09-12",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2023/2854/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/data-act",
  },
  {
    celex: "32022R0868",
    shortName: "Data Governance Act (DGA)",
    title: "Regulation (EU) 2022/868 on European data governance",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2022-05-30",
    entryIntoForce: "2022-06-23",
    applicationDate: "2023-09-24",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2022/868/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/data-governance-act",
  },
  {
    celex: "32022R2065",
    shortName: "Digital Services Act (DSA)",
    title: "Regulation (EU) 2022/2065 on a Single Market For Digital Services",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2022-10-19",
    entryIntoForce: "2022-11-16",
    applicationDate: "2024-02-17",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2022/2065/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package",
  },
  {
    celex: "32022R1925",
    shortName: "Digital Markets Act (DMA)",
    title: "Regulation (EU) 2022/1925 on contestable and fair markets in the digital sector",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2022-09-14",
    entryIntoForce: "2022-11-01",
    applicationDate: "2023-05-02",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2022/1925/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/digital-markets-act",
  },
  {
    celex: "32022L2555",
    shortName: "NIS2 Directive",
    title: "Directive (EU) 2022/2555 on measures for a high common level of cybersecurity across the Union",
    actType: "directive",
    status: "applying",
    adoptionDate: "2022-12-14",
    entryIntoForce: "2023-01-16",
    applicationDate: "2024-10-17",
    eurlexUrl: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/nis2-directive",
  },
  {
    celex: "32024R1183",
    shortName: "eIDAS 2.0",
    title: "Regulation (EU) 2024/1183 amending Regulation (EU) No 910/2014 on electronic identification and trust services",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2024-04-11",
    entryIntoForce: "2024-05-20",
    applicationDate: "2024-05-20",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2024/1183/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation",
  },
  {
    celex: "32016R0679",
    shortName: "GDPR",
    title: "Regulation (EU) 2016/679 on the protection of natural persons with regard to the processing of personal data",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2016-04-27",
    entryIntoForce: "2016-05-24",
    applicationDate: "2018-05-25",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/data-protection",
  },
  {
    celex: "32024L2853",
    shortName: "Product Liability Directive (revised)",
    title: "Directive (EU) 2024/2853 on liability for defective products",
    actType: "directive",
    status: "adopted",
    adoptionDate: "2024-10-23",
    entryIntoForce: "2024-12-08",
    applicationDate: "2026-12-09",
    eurlexUrl: "https://eur-lex.europa.eu/eli/dir/2024/2853/oj",
  },
  {
    celex: "32023R1230",
    shortName: "Machinery Regulation",
    title: "Regulation (EU) 2023/1230 on machinery",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2023-06-14",
    entryIntoForce: "2023-07-19",
    applicationDate: "2027-01-20",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2023/1230/oj",
  },
  {
    celex: "32023R1781",
    shortName: "European Chips Act",
    title: "Regulation (EU) 2023/1781 establishing a framework of measures for strengthening Europe's semiconductor ecosystem",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2023-09-13",
    entryIntoForce: "2023-09-21",
    applicationDate: "2023-09-21",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2023/1781/oj",
  },
  {
    celex: "32024R0903",
    shortName: "Interoperable Europe Act",
    title: "Regulation (EU) 2024/903 laying down measures for a high level of public sector interoperability",
    actType: "regulation",
    status: "applying",
    adoptionDate: "2024-04-11",
    entryIntoForce: "2024-04-11",
    applicationDate: "2024-07-11",
    eurlexUrl: "https://eur-lex.europa.eu/eli/reg/2024/903/oj",
  },
  {
    celex: "32014L0053",
    shortName: "Radio Equipment Directive (RED)",
    title: "Directive 2014/53/EU on the harmonisation of the laws of the Member States relating to the making available on the market of radio equipment",
    actType: "directive",
    status: "applying",
    adoptionDate: "2014-04-16",
    entryIntoForce: "2014-06-12",
    applicationDate: "2017-06-12",
    eurlexUrl: "https://eur-lex.europa.eu/eli/dir/2014/53/oj",
    digitalStrategyUrl: "https://digital-strategy.ec.europa.eu/en/policies/radio-equipment-directive",
  },
]

/** Look up an act by its CELEX identifier. */
export function findAct(celex: string): EuAct | undefined {
  return EU_ACTS.find((a) => a.celex === celex)
}
