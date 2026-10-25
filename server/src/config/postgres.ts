import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { env } from "./env";
import { logger } from "./logger";

export const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30_000,
});

// An idle client erroring (e.g. Postgres restarting) must not crash the process.
pgPool.on("error", (err) => logger.warn({ err: err.message }, "postgres pool error"));

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "db", "migrations");
const MIGRATION_LOCK_ID = 727_001;

/** Applies db/migrations/*.sql in filename order, exactly once each. */
export async function runMigrations(): Promise<void> {
  const client = await pgPool.connect();
  try {
    // Advisory lock: if several replicas boot at once, only one migrates.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [file]);
      if (done.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        logger.info({ file }, "applied migration");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

/**
 * Postgres is an *enhancement* layer for the API (outbox + recommendations),
 * so a failure here degrades features instead of taking the API down.
 */
export async function initPostgres(): Promise<boolean> {
  try {
    await runMigrations();
    logger.info("PostgreSQL ready");
    return true;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "PostgreSQL unavailable — outbox & recommendations degraded");
    return false;
  }
}

export async function pingPostgres(): Promise<boolean> {
  try {
    await pgPool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closePostgres(): Promise<void> {
  await pgPool.end().catch(() => undefined);
}
