// ============================================================================
// Kafka producer — "serious" edition.
//   * idempotent producer, acks=all (no duplicates from producer retries)
//   * every event is zod-validated before it leaves the process
//   * deterministic partition keys (see shared/schemas.ts partitionKey)
//   * headers carry event-type / event-id / correlation-id for tracing
//   * circuit breaker: when the broker is down we stop paying connection
//     timeouts on every request and go straight to the outbox
//   * Postgres outbox fallback + background relay: events survive broker
//     outages and API restarts
//   * publishEvent() NEVER throws — the HTTP request path is never coupled
//     to Kafka availability
// ============================================================================
import { Partitioners, type Producer } from "kafkajs";
import { randomUUID } from "node:crypto";
import { logger } from "../config/logger";
import { drainOutbox, enqueueOutbox, outboxDepth, type OutboxRow } from "./outbox";
import { kafka } from "./kafka";
import {
  EVENT_VERSION,
  EventSchema,
  TOPIC_FOR_EVENT,
  partitionKey,
  type EstateEvent,
  type EventData,
  type EventOf,
  type EventType,
} from "./shared/schemas";

const PRODUCER_NAME = "estatehub-server";
const BREAKER_COOLDOWN_MS = 15_000;
const RELAY_INTERVAL_MS = 5_000;

const producer: Producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 1,
  allowAutoTopicCreation: false,
  createPartitioner: Partitioners.DefaultPartitioner,
});

let connectPromise: Promise<void> | null = null;
let breakerOpenUntil = 0;
let relayTimer: NodeJS.Timeout | null = null;

export const producerMetrics = { published: 0, outboxed: 0, dropped: 0, relayed: 0 };

/** Builds a validated-shape event envelope. */
export function buildEvent<T extends EventType>(
  type: T,
  data: EventData<T>,
  correlationId?: string
): EventOf<T> {
  return {
    eventId: randomUUID(),
    type,
    version: EVENT_VERSION,
    occurredAt: new Date().toISOString(),
    producer: PRODUCER_NAME,
    ...(correlationId ? { correlationId } : {}),
    data,
  } as EventOf<T>;
}

function ensureConnected(): Promise<void> {
  if (!connectPromise) {
    connectPromise = producer.connect().catch((err) => {
      connectPromise = null; // allow a later retry
      throw err;
    });
  }
  return connectPromise;
}

async function sendRaw(topic: string, key: string, event: EstateEvent): Promise<void> {
  await ensureConnected();
  await producer.send({
    topic,
    acks: -1,
    timeout: 10_000,
    messages: [
      {
        key,
        value: JSON.stringify(event),
        timestamp: String(Date.parse(event.occurredAt)),
        headers: {
          "event-type": event.type,
          "event-id": event.eventId,
          ...(event.correlationId ? { "correlation-id": event.correlationId } : {}),
        },
      },
    ],
  });
}

export function isBrokerHealthy(): boolean {
  return Date.now() >= breakerOpenUntil;
}

/** Publishes an event. Never throws; falls back to the Postgres outbox. */
export async function publishEvent(event: EstateEvent): Promise<void> {
  const checked = EventSchema.safeParse(event);
  if (!checked.success) {
    // A programming error: surface loudly, but never break the request.
    logger.error({ issues: checked.error.issues, type: event.type }, "refusing to publish invalid event");
    producerMetrics.dropped++;
    return;
  }

  const topic = TOPIC_FOR_EVENT[event.type];
  const key = partitionKey(event);

  if (isBrokerHealthy()) {
    try {
      await sendRaw(topic, key, event);
      producerMetrics.published++;
      return;
    } catch (err) {
      breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
      logger.warn(
        { err: (err as Error).message, topic, type: event.type, retryInMs: BREAKER_COOLDOWN_MS },
        "kafka publish failed — circuit open, routing to outbox"
      );
    }
  }

  if (await enqueueOutbox(topic, key, event)) producerMetrics.outboxed++;
  else producerMetrics.dropped++;
}

/** Fire-and-forget convenience used by controllers. */
export function emit<T extends EventType>(type: T, data: EventData<T>, correlationId?: string): void {
  void publishEvent(buildEvent(type, data, correlationId));
}

// ---- outbox relay ---------------------------------------------------------

async function relayOnce(): Promise<void> {
  const sent = await drainOutbox(async (row: OutboxRow) => {
    await sendRaw(row.topic, row.message_key, row.payload);
  });
  if (sent > 0) {
    producerMetrics.relayed += sent;
    breakerOpenUntil = 0; // proof the broker is back
    logger.info({ sent, remaining: await outboxDepth() }, "outbox relay delivered events");
  }
}

export function startOutboxRelay(): void {
  if (relayTimer) return;
  relayTimer = setInterval(() => {
    void relayOnce().catch((err) => logger.debug({ err: (err as Error).message }, "relay tick failed"));
  }, RELAY_INTERVAL_MS);
  relayTimer.unref();
}

export async function shutdownProducer(): Promise<void> {
  if (relayTimer) clearInterval(relayTimer);
  relayTimer = null;
  await producer.disconnect().catch(() => undefined);
}
