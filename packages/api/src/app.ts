/**
 * ORSD API — Express Application
 */

import express from "express";
import pino from "pino";
import routes from "./routes/index.js";

const logger = pino({ name: "orsd/api" });

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Routes
  app.use(routes);

  return app;
}

export async function startServer(port = parseInt(process.env.PORT || "3003", 10)) {
  const app = createApp();

  app.listen(port, () => {
    logger.info({ port }, "ORSD API server started");
  });
}
