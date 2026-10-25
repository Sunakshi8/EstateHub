import { Kafka, logLevel } from "kafkajs";
import { config } from "./config";
import { logger } from "./logger";
import { SeenEvents, notify } from "./notifications";
import { ResilientConsumer } from "./shared/consumerRunner";
import { ensureTopics } from "./shared/topicAdmin";
import { Topics } from "./shared/topics";

const kafka = new Kafka({
  clientId: "notification-consumer",
  brokers: config.kafkaBrokers,
  connectionTimeout: 5000,
  retry: { initialRetryTime: 300, retries: 10 },
  logLevel: logLevel.ERROR,
});

async function withRetry<T>(name: string, fn: () => Promise<T>, attempts = 12): Promise<T> {
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
  await withRetry("kafka topics", () =>
    ensureTopics(kafka, logger, { replicationFactor: config.KAFKA_REPLICATION_FACTOR })
  );

  const seen = new SeenEvents();
  const consumer = new ResilientConsumer({
    kafka,
    logger,
    groupId: config.CONSUMER_GROUP,
    topics: [Topics.INQUIRIES],
    handle: async (event) => notify(event, seen, logger),
    onFatal: () => process.exit(1),
  });
  await withRetry("kafka consumer", () => consumer.start());

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    await consumer.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "notification-consumer failed to start");
  process.exit(1);
});
