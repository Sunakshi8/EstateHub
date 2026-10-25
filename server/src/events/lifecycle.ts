import { env } from "../config/env";
import { logger } from "../config/logger";
import { kafka } from "./kafka";
import { shutdownProducer, startOutboxRelay } from "./producer";
import { ensureTopics } from "./shared/topicAdmin";

/**
 * Provisions topics and starts the outbox relay. Non-fatal: if Kafka isn't up
 * yet we keep retrying in the background while the API serves traffic.
 */
export function startEventInfrastructure(): void {
  startOutboxRelay();

  const attempt = async (n: number): Promise<void> => {
    try {
      await ensureTopics(kafka, logger, { replicationFactor: env.KAFKA_REPLICATION_FACTOR });
    } catch (err) {
      const delay = Math.min(30_000, 2_000 * 2 ** n);
      logger.warn({ err: (err as Error).message, retryInMs: delay }, "kafka not ready, will retry topic provisioning");
      setTimeout(() => void attempt(n + 1), delay).unref();
    }
  };
  void attempt(0);
}

export { shutdownProducer };
