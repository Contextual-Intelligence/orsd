/**
 * Dgraph Client — extracted from monorepo leads/dgraph/client.ts
 *
 * Lightweight GraphQL client for Dgraph. Used by the ORSD API
 * to serve read-only queries against the regulatory knowledge graph.
 */

import pino from "pino";

const logger = pino({ name: "orsd/dgraph-client" });

export interface DgraphConfig {
  url: string;
}

let config: DgraphConfig | null = null;

export function initDgraph(cfg: DgraphConfig): void {
  config = cfg;
}

function getBaseUrl(): string {
  return config?.url ?? process.env.DGRAPH_URL ?? "http://localhost:8080";
}

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const url = `${getBaseUrl()}/graphql`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Dgraph GraphQL error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { errors?: Array<{ message: string }>; data?: T };
  if (json.errors) {
    throw new Error(`Dgraph query error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const dgraph = {
  query: graphqlRequest,
};
