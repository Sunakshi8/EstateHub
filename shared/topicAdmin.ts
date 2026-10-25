// Idempotent topic provisioning (partitions, retention, compaction, min-ISR).
// Called on startup by every service so topics never rely on broker
// auto-creation defaults.
import type { Kafka, ITopicConfig } from "kafkajs";
import { TOPIC_SPECS } from "./topics";
import type { Logger } from "./logger";

export async function ensureTopics(
  kafka: Kafka,
  logger: Logger,
  opts: { replicationFactor?: number } = {}
): Promise<void> {
  const replicationFactor = opts.replicationFactor ?? 1;
  const minIsr = replicationFactor > 1 ? 2 : 1;

  const admin = kafka.admin();
  await admin.connect();
  try {
    const topics: ITopicConfig[] = TOPIC_SPECS.map((s) => ({
      topic: s.name,
      numPartitions: s.partitions,
      replicationFactor,
      configEntries: [
        { name: "retention.ms", value: String(s.retentionMs) },
        { name: "cleanup.policy", value: s.cleanupPolicy },
        { name: "min.insync.replicas", value: String(minIsr) },
      ],
    }));
    const created = await admin.createTopics({ topics, waitForLeaders: true });
    logger.info(
      { created, topics: TOPIC_SPECS.map((t) => t.name) },
      created ? "kafka topics created" : "kafka topics already present"
    );
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}
