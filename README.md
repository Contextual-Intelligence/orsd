# Open Regulatory Signal Dataset (ORSD)

A public dataset of regulatory signals — FDA clearances, clinical trials, EUDAMED certifications, and market-moving regulatory news — aggregated from **22+ data sources across 10 regulatory jurisdictions**.

## License

**Database compilation:** ODbL v1.0 — individual data retains original source licenses. See [`docs/LICENSE`](docs/LICENSE) for details.

## Quick Start

```bash
npm install
npm run build

# Start the API server (reads from Dgraph)
npm run start:api

# Run a full crawl (ingest signals from all sources)
npm run crawl
```

## Repo Structure

```
packages/
  api/          # Public REST API serving the ORSD dataset
  crawler/      # Ingestion pipelines for all regulatory sources
deploy/         # Dockerfiles, docker-compose, infrastructure
docs/           # Data sources, licensing, API reference, contribution guide
adr/            # Architecture Decision Records
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dataset metadata & attribution |
| `GET /v1/stats` | Dataset statistics |
| `GET /v1/companies` | All tracked companies |
| `GET /v1/signals` | Regulatory signals (filterable by type, paginated) |

See [`docs/API.md`](docs/API.md) for full reference.

## Data Sources

ORSD aggregates from 22+ sources including FDA (510(k), PMA, De Novo, CLIA), EUDAMED, ANVISA (Brazil), PMDA (Japan), CDSCO (India), NMPA (China), TGA (Australia), Health Canada, MFDS (South Korea), and WHO. Full attribution in [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for how to add a new data source or improve signal quality.
