# Open Regulatory Signal Dataset (ORSD)

A public dataset of regulatory signals — FDA clearances, clinical trials, EUDAMED certifications, and market-moving regulatory news — aggregated from **data sources across global regulatory jurisdictions**.

[![CI](https://github.com/Contextual-Intelligence/orsd/actions/workflows/ci.yml/badge.svg)](https://github.com/Contextual-Intelligence/orsd/actions/workflows/ci.yml)
[![License: ODbL v1.0](https://img.shields.io/badge/License-ODbL%201.0-blue.svg)](https://opendatacommons.org/licenses/odbl/1-0/)
[![API stability](https://img.shields.io/badge/API-v0.1-yellow)](https://orsd.contextual-intelligence.org)

## Quick Start

**Prerequisites:** Node.js 22+, Docker (for Dgraph).

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Start Dgraph + API (via Docker Compose)
docker compose -f deploy/docker-compose.yml up -d

# 4. Run a crawl (ingests from all 12 sources into Dgraph)
npm run crawl

# 5. Explore the API
curl http://localhost:3003/v1/stats
curl http://localhost:3003/v1/signals?limit=5
```

### Running without Docker

Start Dgraph separately, then:

```bash
# Set Dgraph endpoint
export DGRAPH_URL=http://localhost:8080

# Start API
npm run start:api

# In another terminal, crawl sources
npm run crawl
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DGRAPH_URL` | `http://localhost:8080` | Dgraph GraphQL endpoint |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch endpoint (optional) |
| `PORT` | `3003` | API server port |
| `CRAWL_INTERVAL_HOURS` | `24` | Source crawl interval |
| `MAX_SIGNALS_PER_SOURCE` | `5000` | Max signals per source per crawl |
| `ORSD_USER_AGENT` | `ORSD-Crawler/0.1` | User-Agent header for HTTP fetches |
| `MFDS_API_KEY` | *(none)* | API key for South Korea MFDS data |

See [`.env.example`](.env.example) for a template.

## API

### `GET /`

Dataset metadata and attribution.

```json
{
  "name": "Open Regulatory Signal Dataset (ORSD)",
  "version": "0.1",
  "license": "Database compilation: ODbL v1.0",
  "endpoints": {
    "stats": "/v1/stats",
    "companies": "/v1/companies",
    "signals": "/v1/signals"
  }
}
```

### `GET /v1/signals`

Regulatory signals with pagination and filters.

| Param | Type | Description |
|-------|------|-------------|
| `limit` | int (1–1000) | Page size (default 100) |
| `offset` | int | Pagination offset |
| `type` | string | Filter by signal type (e.g., `FDA_510K`) |
| `source` | string | Filter by source (`fda`, `eudamed`, `who`, ...) |
| `jurisdiction` | string | Filter by jurisdiction (`US`, `EU`, `BR`, ...) |

**Example:** `GET /v1/signals?type=WHO_PQ&limit=10`

### `GET /v1/companies`

Tracked medical device companies.

| Param | Type | Description |
|-------|------|-------------|
| `limit` | int (1–1000) | Page size |
| `offset` | int | Pagination offset |
| `segment` | string | Filter by segment |
| `region` | string | Filter by region |

### `GET /v1/stats`

Dataset coverage statistics (companies, signals, jurisdictions).

Full documentation: [`docs/API.md`](docs/API.md)

## Repo Structure

```
orsd/
├── packages/
│   ├── api/          # Express REST API (read-only, Dgraph-backed)
│   └── crawler/      # Ingestion pipeline: 11 source connectors + ETL
├── deploy/           # Dockerfiles, docker-compose
├── docs/             # API reference, data sources, contributing guide
├── adr/              # Architecture Decision Records
├── .env.example      # Environment variable template
└── vitest.config.ts  # Test configuration (103+ tests)
```

### Pipeline

```
Source Connector → Normalize → Enrich → Dedup → Confidence → Write (Dgraph)
                                                                    ↓
                                                              API (read)
```

Each connector implements a multi-strategy fallback: primary API → CSV/scrape → graceful empty. All 11 connectors are tested.

## Data Sources

| Jurisdiction | Source | Connector | Strategy |
|---|---|---|---|
| 🇺🇸 US | FDA (510(k), PMA, De Novo, CLIA) | `fda` | API (open.fda.gov) |
| 🇺🇸 US | ClinicalTrials.gov | `clinicaltrials` | API v2 (paginated) |
| 🇪🇺 EU | EUDAMED | `eudamed` | Public API → dashboard |
| 🇪🇺 EU | EU legislation (CRA, AI Act, NIS2, GDPR, DORA, MiCA, EHDS, …) | `eu-legislation` | EUR-Lex SPARQL → curated registry (22 acts) |
| 🇧🇷 Brazil | ANVISA | `anvisa` | Open Data API → CSV |
| 🇯🇵 Japan | PMDA | `pmda` | CSV export → API |
| 🇮🇳 India | CDSCO | `cdsco` | data.gov.in API → portal |
| 🇨🇳 China | NMPA | `nmpa` | data.gov.cn API → scraping |
| 🇦🇺 Australia | TGA | `tga` | data.gov.au → TGA API |
| 🇨🇦 Canada | Health Canada | `health_canada` | HC API → Open Canada CSV |
| 🇰🇷 S. Korea | MFDS | `mfds` | data.go.kr API → portal |
| 🌍 WHO | Prequalification | `who` | PQ API → CSV → JSON-LD |

## Architecture

The system uses an **extract-and-serve** pattern: the crawler fetches data from regulatory sources, normalizes it, and writes to Dgraph. The API serves read-only queries from the same Dgraph instance. This decouples ingestion from serving — the crawler can run on-demand or via cron without affecting API availability.

See [`docs/API.md`](docs/API.md) for endpoint details, [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md) for source attribution, and [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for adding new connectors.

## License

**Database compilation:** ODbL v1.0 — individual data retains original source licenses. See [`docs/LICENSE`](docs/LICENSE).
