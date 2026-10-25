import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ResilientConsumer } from "../shared/consumerRunner";
import { config } from "../config";
import { pool } from "../db/pool";
import { loadCandidates, loadPopularity, loadPreferences } from "../db/repo";
import { logger } from "../logger";
import { buildPrefIndex, decayedScore, rankCandidates } from "../scoring/score";

function tokenOk(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.INTERNAL_API_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const internalOnly = (req: Request, res: Response, next: NextFunction) =>
  tokenOk(req.header("x-internal-token")) ? next() : void res.status(401).json({ message: "unauthorized" });

const clampLimit = (v: unknown, def: number, max: number) =>
  Math.min(max, Math.max(1, Number(v) || def));

export function createHttpApp(consumer: ResilientConsumer) {
  const app = express();

  app.get("/health", async (_req, res) => {
    let pg = false;
    try { await pool.query("SELECT 1"); pg = true; } catch { /* reported below */ }
    const consumerRunning = consumer.isRunning();
    res.status(pg && consumerRunning ? 200 : 503).json({
      status: pg && consumerRunning ? "ok" : "degraded",
      postgres: pg,
      consumer: consumerRunning,
      metrics: consumer.metrics,
    });
  });

  // Ranked recommendations — the end of the pipeline:
  //   Kafka -> consumer -> PostgreSQL (user_preferences) -> preference score -> here
  app.get("/v1/recommendations/:userId", internalOnly, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const limit = clampLimit(req.query.limit, 10, 50);
      const [prefRows, candidates, popularity] = await Promise.all([
        loadPreferences(pool, userId),
        loadCandidates(pool, userId),
        loadPopularity(pool),
      ]);
      const index = buildPrefIndex(prefRows, new Date(), config.HALF_LIFE_DAYS);
      res.json(rankCandidates(index, candidates, popularity, limit));
    } catch (err) { next(err); }
  });

  // The raw learned preference scores for a user, decayed to "now".
  app.get("/v1/preferences/:userId", internalOnly, async (req, res, next) => {
    try {
      const limit = clampLimit(req.query.limit, 25, 100);
      const now = new Date();
      const rows = await loadPreferences(pool, req.params.userId);
      const preferences = rows
        .map((r) => ({
          featureType: r.featureType,
          featureValue: r.featureValue,
          score: Math.round(decayedScore(r.score, r.updatedAt, now, config.HALF_LIFE_DAYS) * 100) / 100,
        }))
        .filter((r) => r.score > 0.01)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      res.json({ preferences });
    } catch (err) { next(err); }
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "request failed");
    res.status(500).json({ message: "internal error" });
  });

  return app;
}
