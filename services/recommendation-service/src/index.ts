import { config } from "./config";
import { logger } from "./logger";
import { pool, migrateWithRetry } from "./db/pool";
import { kafka } from "./kafka/kafka";
import { handleEvent } from "./kafka/handlers";
import { createHttpApp } from "./http/server";
import { ResilientConsumer } from "./shared/consumerRunner";
import { ensureTopics } from "./shared/topicAdmin";
import { Topics } from "./shared/topics";

async function retry<T>(name: string, fn: () => Promise<T>, attempts = 12): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      const delay = Math.min(10_000, 500 * 2 ** i);
      logger.warn({ err: (err as Error).message, attempt: i, retryInMs: delay }, `${name} not ready, retrying`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function main(): Promise<void> {
  await migrateWithRetry();
  await retry("kafka topics", () =>
    ensureTopics(kafka, logger, { replicationFactor: config.KAFKA_REPLICATION_FACTOR })
  );

  const consumer = new ResilientConsumer({
    kafka,
    logger,
    groupId: config.CONSUMER_GROUP,
    topics: [Topics.INQUIRIES, Topics.INTERACTIONS, Topics.PROPERTIES],
    // First start replays history: the compacted properties topic rebuilds the
    // property read model, and past interactions rebuild preference scores.
    fromBeginning: true,
    partitionsConsumedConcurrently: 3,
    handle: handleEvent,
    onFatal: () => process.exit(1), // let the orchestrator restart us
  });
  await retry("kafka consumer", () => consumer.start());

  const app = createHttpApp(consumer);
  const server = app.listen(config.HTTP_PORT, () =>
    logger.info({ port: config.HTTP_PORT }, "recommendation-service HTTP API listening")
  );

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "shutting down");
    setTimeout(() => process.exit(1), 15_000).unref();
    server.close();
    await consumer.stop();
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "recommendation-service failed to start");
  process.exit(1);
});
