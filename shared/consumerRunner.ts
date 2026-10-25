// ============================================================================
// ResilientConsumer — the Kafka consumption pattern every EstateHub service
// uses. What it guarantees:
//   * at-least-once delivery (offsets are committed only after the handler
//     succeeds or the message is safely parked in the DLQ)
//   * every message is validated against the zod event contract
//   * transient failures are retried with exponential backoff + jitter
//   * poison messages (bad JSON / bad schema / NonRetryableError) and
//     messages that exhaust their retries go to `<topic>.dlq` with full
//     diagnostic headers, so a bad message never blocks a partition
//   * unknown event types are skipped (forward-compatible with newer
//     producers) instead of being treated as errors
//   * if the DLQ write itself fails we throw, so Kafka redelivers instead of
//     silently losing the message
//   * graceful shutdown + crash detection (process exits so the orchestrator
//     restarts it)
// Handlers MUST be idempotent — at-least-once means duplicates will happen.
// ============================================================================
import type { Consumer, Kafka, Producer } from "kafkajs";
import { EVENT_TYPES, EventSchema, type EstateEvent } from "./schemas";
import { dlqTopic } from "./topics";
import type { Logger } from "./logger";

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export interface MessageContext {
  topic: string;
  partition: number;
  offset: string;
  attempt: number;
}

export interface RunnerMetrics {
  processed: number;
  retried: number;
  deadLettered: number;
  skipped: number;
  lastProcessedAt: string | null;
}

export interface RunnerOptions {
  kafka: Kafka;
  logger: Logger;
  groupId: string;
  topics: string[];
  handle: (event: EstateEvent, ctx: MessageContext) => Promise<void>;
  fromBeginning?: boolean;
  maxAttempts?: number;
  baseBackoffMs?: number;
  partitionsConsumedConcurrently?: number;
  /** Called if the consumer crashes beyond kafkajs's own retry budget. */
  onFatal?: (err: Error) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ResilientConsumer {
  private readonly consumer: Consumer;
  private readonly dlqProducer: Producer;
  private running = false;
  readonly metrics: RunnerMetrics = {
    processed: 0,
    retried: 0,
    deadLettered: 0,
    skipped: 0,
    lastProcessedAt: null,
  };

  constructor(private readonly opts: RunnerOptions) {
    this.consumer = opts.kafka.consumer({
      groupId: opts.groupId,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
      retry: { retries: 8 },
    });
    this.dlqProducer = opts.kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    const { logger, groupId, topics, fromBeginning } = this.opts;

    this.consumer.on(this.consumer.events.CRASH, (e) => {
      this.running = false;
      logger.error({ err: e.payload.error, restart: e.payload.restart }, "consumer crashed");
      if (!e.payload.restart) this.opts.onFatal?.(e.payload.error);
    });

    await this.dlqProducer.connect();
    await this.consumer.connect();
    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: fromBeginning ?? false });
    }

    await this.consumer.run({
      partitionsConsumedConcurrently: this.opts.partitionsConsumedConcurrently ?? 1,
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        await this.processMessage(topic, partition, message, heartbeat);
      },
    });

    this.running = true;
    logger.info({ groupId, topics }, "consumer running");
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.consumer.disconnect().catch(() => undefined);
    await this.dlqProducer.disconnect().catch(() => undefined);
  }

  private async processMessage(
    topic: string,
    partition: number,
    message: { offset: string; value: Buffer | null; key: Buffer | null },
    heartbeat: () => Promise<void>
  ): Promise<void> {
    const { logger, handle } = this.opts;
    const maxAttempts = this.opts.maxAttempts ?? 4;
    const baseBackoff = this.opts.baseBackoffMs ?? 200;
    const raw = message.value?.toString() ?? "";
    const where = { topic, partition, offset: message.offset };

    // ---- 1. parse + validate -------------------------------------------
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.deadLetter(topic, partition, message, "invalid_json", "message is not valid JSON", 0);
    }

    const type = (json as { type?: unknown } | null)?.type;
    if (typeof type === "string" && !EVENT_TYPES.has(type)) {
      this.metrics.skipped++;
      logger.debug({ ...where, type }, "skipping unknown event type");
      return;
    }

    const parsed = EventSchema.safeParse(json);
    if (!parsed.success) {
      return this.deadLetter(
        topic, partition, message, "schema_violation",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 0
      );
    }
    const event = parsed.data;

    // ---- 2. handle with retries ----------------------------------------
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await handle(event, { ...where, attempt });
        this.metrics.processed++;
        this.metrics.lastProcessedAt = new Date().toISOString();
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError instanceof NonRetryableError) break;
        if (attempt < maxAttempts) {
          this.metrics.retried++;
          const delay = baseBackoff * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5);
          logger.warn(
            { ...where, eventId: event.eventId, type: event.type, attempt, err: lastError.message },
            "handler failed, retrying"
          );
          await sleep(delay);
          await heartbeat().catch(() => undefined); // stay in the group while backing off
        }
      }
    }

    // ---- 3. exhausted -> DLQ -------------------------------------------
    await this.deadLetter(
      topic, partition, message, "handler_failed", lastError?.message ?? "unknown error", maxAttempts,
      event
    );
  }

  private async deadLetter(
    topic: string,
    partition: number,
    message: { offset: string; value: Buffer | null; key: Buffer | null },
    reason: string,
    error: string,
    attempts: number,
    event?: EstateEvent
  ): Promise<void> {
    const { logger, groupId } = this.opts;
    // If this throws, kafkajs redelivers the message: we never drop it.
    await this.dlqProducer.send({
      topic: dlqTopic(topic),
      acks: -1,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers: {
            "dlq-reason": reason,
            "dlq-error": error.slice(0, 1000),
            "dlq-attempts": String(attempts),
            "dlq-source-topic": topic,
            "dlq-source-partition": String(partition),
            "dlq-source-offset": message.offset,
            "dlq-consumer-group": groupId,
            "dlq-failed-at": new Date().toISOString(),
            ...(event ? { "event-id": event.eventId, "event-type": event.type } : {}),
          },
        },
      ],
    });
    this.metrics.deadLettered++;
    logger.error(
      { topic, partition, offset: message.offset, reason, error, eventId: event?.eventId },
      "message dead-lettered"
    );
  }
}
