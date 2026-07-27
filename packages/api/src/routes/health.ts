/**
 * Health Endpoint
 *
 * GET /api/health — returns status and dependency checks.
 */

import { Router, type Request, type Response } from "express";
import { healthCheck } from "../services/dgraph.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const dgraphOk = await healthCheck();

  res.json({
    status: dgraphOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: {
      dgraph: dgraphOk ? "up" : "down",
    },
  });
});

export default router;
