/**
 * ORSD API — Express Application
 *
 * Hardened with:
 *  - CORS headers (open for public API)
 *  - JSON body parsing
 *  - Request logging via pino
 *  - Global error handler (Express 5 async error catching)
 *  - 404 handler for unknown routes
 *  - Graceful shutdown on SIGTERM/SIGINT
 */

import express, { type Request, type Response, type NextFunction } from "express";
import pino from "pino";
import routes from "./routes/index.js";

const logger = pino({ name: "orsd/api" });

export function createApp() {
  const app = express();

  // Trust proxy for correct IP logging behind reverse proxies
  app.set("trust proxy", true);

  // ----- Middleware -----

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip,
        ua: req.get("user-agent") || "-",
      }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  // CORS — open for public dataset API
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // ----- Routes -----
  app.use(routes);

  // ----- 404 handler -----
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: "not_found",
      message: `Route ${_req.method} ${_req.path} not found`,
    });
  });

  // ----- Global error handler (Express 5 async errors) -----
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error: err.message, stack: err.stack }, "Unhandled error");
    res.status(500).json({
      error: "internal_error",
      message: "An unexpected error occurred",
    });
  });

  return app;
}

export async function startServer(port = parseInt(process.env.PORT || "3003", 10)) {
  const app = createApp();

  const server = app.listen(port, () => {
    logger.info({ port }, "ORSD API server started");
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Prevent unhandled rejections crashing the process — log and continue
  process.on("unhandledRejection", (reason) => {
    logger.error({ error: reason }, "Unhandled rejection");
  });
}
