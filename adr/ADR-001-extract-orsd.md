# ADR-001: ORSD as a Standalone Repository

- Status: accepted
- Date: 2026-07-25
- Decision-makers: Tobias Weiss
- Reference: [Monorepo ADR-0005](../ADR-0005-extract-orsd-to-own-repo.md)

## Context

The Open Regulatory Signal Dataset (ORSD) was originally embedded inside
the main application monorepo as a thin API route + shared Dgraph schema.
The decision was made to extract it into its own repository so that:

1. Ingestion pipelines (crawlers) can be developed independently
2. The data model is no longer coupled to the Leads app's Dgraph schema
3. Licensing (ODbL) is clear and separate from the monorepo's license
4. External contributors can add data sources without seeing SaaS internals

## Decision

ORSD lives at `github.com/contextual-intelligence/orsd` as a standalone
repository with two packages: `api` (public read-only API) and `crawler`
(ingestion pipelines for 22+ sources across 10 jurisdictions).

## Consequences

- Positive: Independent CI/CD, schema ownership, and contribution path.
- Positive: The monorepo's compliance service will call ORSD via HTTP.
- Negative: Two-repo overhead; compliance integration needs refactoring.
