import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { config } from "../config";
import { logger } from "../logger";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
});
pool.on("error", (err) => logger.warn({ err: err.message }, "postgres pool error"));

/** Runs `fn` inside a transaction; commits on success, rolls back on throw. */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "db", "migrations");
const LOCK_ID = 727_002;

export async function runMigrations(p: Pool = pool, dir: string = MIGRATIONS_DIR): Promise<void> {
  const client = await p.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query("CREATE SCHEMA IF NOT EXISTS reco");
    await client.query(
      `CREATE TABLE IF NOT EXISTS reco.schema_migrations (
         filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    );
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      const done = await client.query("SELECT 1 FROM reco.schema_migrations WHERE filename = $1", [file]);
      if (done.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
        await client.query("INSERT INTO reco.schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        logger.info({ file }, "applied migration");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

/** Retries migrations while Postgres is still starting up. */
export async function migrateWithRetry(attempts = 10): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await runMigrations();
      return;
    } catch (err) {
      if (i >= attempts) throw err;
      const delay = Math.min(10_000, 500 * 2 ** i);
      logger.warn({ err: (err as Error).message, attempt: i, retryInMs: delay }, "postgres not ready, retrying");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
