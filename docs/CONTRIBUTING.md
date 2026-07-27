# Contributing to ORSD

We welcome contributions of new data sources, improvements to existing
connectors, and better signal quality tooling.

## Adding a New Data Source

1. **Check existing sources** — see [DATA-SOURCES.md](DATA-SOURCES.md) for
   what's already covered or planned.

2. **Create a source connector** under `packages/crawler/src/sources/<name>/`:

   ```
   packages/crawler/src/sources/<name>/
   ├── index.ts         # SourceConnector class exporting fetch()
   ├── <endpoint>.ts    # One file per API endpoint/sub-source
   ```

   Your connector must implement the `SourceConnector` interface:

   ```ts
   import type { SourceConnector } from "../index.js";

   export class MySource implements SourceConnector {
     name = "my-source";
     jurisdiction = "US"; // from the Jurisdiction type
     async fetch(config: CrawlerConfig): Promise<RawSignal[]> { ... }
   }
   ```

3. **Register the source** in `packages/crawler/src/sources/index.ts`.

4. **Test** — run against the real API endpoint:
   ```
   npm -w packages/crawler run start -- --sources my-source --dry-run
   ```

5. **Update docs** — add your source to `docs/DATA-SOURCES.md`.

## Signal Quality Guidelines

- Every signal must have a URL pointing back to the original source record.
- Company names should use the legal entity name when possible.
- Product codes should use the jurisdiction's official classification system.
- Confidence scores should be conservative — prefer `medium` over `high` when uncertain.

## Code Style

- TypeScript with strict mode
- ES modules (`import`/`export`, no CommonJS)
- No semicolons (project convention)
- `pino` for structured logging

## PR Process

1. Open a PR with a clear description of the source and what data it provides.
2. Include a sample output from `--dry-run` so reviewers can verify the shape.
3. Ensure all data sources are publicly available and properly attributed.
