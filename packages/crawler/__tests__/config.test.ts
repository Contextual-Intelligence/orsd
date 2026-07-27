import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    // Clear ORSD-specific env vars
    delete process.env.DGRAPH_URL;
    delete process.env.ELASTICSEARCH_URL;
    delete process.env.CRAWL_INTERVAL_HOURS;
    delete process.env.MAX_SIGNALS_PER_SOURCE;
    delete process.env.ORSD_USER_AGENT;
  });

  it("should return defaults when no env vars are set", () => {
    const config = loadConfig();
    expect(config.dgraphUrl).toBe("http://localhost:8080");
    expect(config.elasticsearchUrl).toBe("http://localhost:9200");
    expect(config.defaultIntervalHours).toBe(24);
    expect(config.maxSignalsPerSource).toBe(5000);
    expect(config.userAgent).toBe("ORSD-Crawler/0.1");
  });

  it("should read DGRAPH_URL from env", () => {
    process.env.DGRAPH_URL = "https://dgraph.example.com";
    expect(loadConfig().dgraphUrl).toBe("https://dgraph.example.com");
  });

  it("should parse integer env vars", () => {
    process.env.CRAWL_INTERVAL_HOURS = "12";
    process.env.MAX_SIGNALS_PER_SOURCE = "100";
    expect(loadConfig().defaultIntervalHours).toBe(12);
    expect(loadConfig().maxSignalsPerSource).toBe(100);
  });

  it("should fall back to defaults for invalid integer env vars", () => {
    process.env.CRAWL_INTERVAL_HOURS = "not-a-number";
    expect(loadConfig().defaultIntervalHours).toBe(24);
  });

  it("should read ORSD_USER_AGENT from env", () => {
    process.env.ORSD_USER_AGENT = "MyCrawler/1.0";
    expect(loadConfig().userAgent).toBe("MyCrawler/1.0");
  });
});
