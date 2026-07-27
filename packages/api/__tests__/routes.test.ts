import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import supertest from "supertest";

describe("API routes", () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(() => {
    global.fetch = vi.fn();
    const app = createApp();
    request = supertest(app);
  });

  it("GET / should return dataset metadata", async () => {
    const res = await request.get("/").expect(200);
    expect(res.body.name).toBe("Open Regulatory Signal Dataset (ORSD)");
    expect(res.body.version).toBe("0.1");
    expect(res.body.endpoints).toBeDefined();
    expect(res.body.endpoints.stats).toBe("/v1/stats");
  });

  it("GET /api/health should return ok when Dgraph is up", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("OK", { status: 200 }));

    const res = await request.get("/api/health").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.checks.dgraph).toBe("up");
  });

  it("GET /api/health should return degraded when Dgraph is down", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Connection refused"));

    const res = await request.get("/api/health").expect(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.dgraph).toBe("down");
  });

  it("GET /v1/companies should return 503 when Dgraph is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Dgraph down"));

    const res = await request.get("/v1/companies").expect(503);
    expect(res.body.error).toBe("database_unavailable");
  });

  it("GET /v1/companies should pipe Dgraph data through", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            queryCompany: [
              { normalizedName: "acme", name: "Acme Corp", segment: "IVD", region: "EU" },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const res = await request.get("/v1/companies").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].normalizedName).toBe("acme");
    expect(res.body.meta.version).toBe("0.1");
  });

  it("GET /v1/signals should support pagination params", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            querySignal: Array.from({ length: 50 }, (_, i) => ({
              type: "FDA_510K",
              date: "2026-01-01",
              confidence: 0.9,
              description: `Signal ${i}`,
              url: "",
            })),
          },
        }),
        { status: 200 },
      ),
    );

    const res = await request.get("/v1/signals?limit=50&offset=0").expect(200);
    expect(res.body.data).toHaveLength(50);
    expect(res.body.meta.limit).toBe(50);
    expect(res.body.meta.offset).toBe(0);
  });

  it("GET /v1/stats should return coverage info", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              queryCompany: Array.from({ length: 100 }, (_, i) => ({
                normalizedName: `c${i}`,
              })),
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              querySignal: [
                { type: "FDA_510K" },
                { type: "FDA_PMA" },
                { type: "FDA_510K" },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const res = await request.get("/v1/stats").expect(200);
    expect(res.body.stats.companies).toBe(100);
    expect(res.body.stats.signals).toBe(3);
    expect(res.body.stats.signal_types).toEqual(["FDA_510K", "FDA_PMA"]);
    expect(res.body.stats.coverage.countries).toContain("US");
    expect(res.body.stats.coverage.data_sources).toBe(22);
  });
});
