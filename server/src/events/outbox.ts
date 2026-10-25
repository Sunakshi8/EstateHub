import type { PoolClient } from "pg";
import { logger } from "../config/logger";
import { pgPool } from "../config/postgres";
import type { EstateEvent } from "./shared/schemas";

export interface OutboxRow {
  id: string;
  event_id: string;
  topic: string;
  message_key: string;
  payload: EstateEvent;
  attempts: number;
}

/** Parks an event in Postgres so it can be delivered once Kafka is back. */
export async function enqueueOutbox(topic: string, key: string, event: EstateEvent): Promise<boolean> {
  try {
    await pgPool.query(
      `INSERT INTO outbox_events (event_id, topic, message_key, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, topic, key, JSON.stringify(event)]
    );
    return true;
  } catch (err) {
    logger.error(
      { err: (err as Error).message, eventId: event.eventId, type: event.type },
      "outbox write failed — event dropped (Kafka AND Postgres unavailable)"
    );
    return false;
  }
}

/**
 * Drains pending outbox rows in id order. `send` delivers one row to Kafka.
 * Stops at the first failure so ordering within the outbox is preserved.
 * FOR UPDATE SKIP LOCKED makes this safe with multiple API replicas.
 */
export async function drainOutbox(
  send: (row: OutboxRow) => Promise<void>,
  batchSize = 100
): Promise<number> {
  let client: PoolClient | undefined;
  let sent = 0;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");
    const { rows } = await client.query<OutboxRow>(
      `SELECT id, event_id, topic, message_key, payload, attempts
         FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );
    for (const row of rows) {
      try {
        await send(row);
        await client.query("UPDATE outbox_events SET published_at = now() WHERE id = $1", [row.id]);
        sent++;
      } catch (err) {
        await client.query(
          "UPDATE outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1",
          [row.id, (err as Error).message.slice(0, 500)]
        );
        break;
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => undefined);
    logger.debug({ err: (err as Error).message }, "outbox drain skipped");
  } finally {
    client?.release();
  }
  return sent;
}

export async function outboxDepth(): Promise<number | null> {
  try {
    const { rows } = await pgPool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM outbox_events WHERE published_at IS NULL"
    );
    return Number(rows[0].n);
  } catch {
    return null;
  }
}
