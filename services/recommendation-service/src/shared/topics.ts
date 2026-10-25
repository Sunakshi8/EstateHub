// ============================================================================
// SOURCE OF TRUTH for Kafka topics. Edit here, then run `npm run sync:shared`
// from the repo root — it copies this file into every service that needs it
// (services are built/deployed independently, so each gets its own copy).
// ============================================================================

export const Topics = {
  INQUIRIES: "estatehub.inquiries",
  INTERACTIONS: "estatehub.interactions",
  PROPERTIES: "estatehub.properties",
} as const;

export type Topic = (typeof Topics)[keyof typeof Topics];

/** Dead-letter topic for a given source topic. */
export const dlqTopic = (topic: string): string => `${topic}.dlq`;

export interface TopicSpec {
  name: string;
  partitions: number;
  retentionMs: number;
  /** "compact,delete" keeps the latest record per key AND expires old ones. */
  cleanupPolicy: "delete" | "compact" | "compact,delete";
}

const DAY = 86_400_000;

const MAIN_TOPICS: TopicSpec[] = [
  // Keyed by buyerId -> all of a buyer's inquiry events stay ordered.
  { name: Topics.INQUIRIES, partitions: 3, retentionMs: 7 * DAY, cleanupPolicy: "delete" },
  // Keyed by userId -> per-user ordering of views/favorites/searches.
  { name: Topics.INTERACTIONS, partitions: 6, retentionMs: 7 * DAY, cleanupPolicy: "delete" },
  // Keyed by propertyId + compacted -> the topic always holds the latest
  // known state of every property, so a brand-new consumer can rebuild its
  // read model by replaying from the beginning.
  { name: Topics.PROPERTIES, partitions: 3, retentionMs: 30 * DAY, cleanupPolicy: "compact,delete" },
];

export const TOPIC_SPECS: TopicSpec[] = [
  ...MAIN_TOPICS,
  ...MAIN_TOPICS.map<TopicSpec>((t) => ({
    name: dlqTopic(t.name),
    partitions: 1,
    retentionMs: 14 * DAY,
    cleanupPolicy: "delete",
  })),
];
