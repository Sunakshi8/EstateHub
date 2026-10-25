import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_BROKER: z.string().optional(), // legacy name
  KAFKA_REPLICATION_FACTOR: z.coerce.number().int().positive().default(1),
  CONSUMER_GROUP: z.string().default("notification-service"),
  LOG_LEVEL: z.string().default("info"),
  NODE_ENV: z.string().default("development"),
});

const env = schema.parse(process.env);

export const config = {
  ...env,
  kafkaBrokers: (env.KAFKA_BROKERS ?? env.KAFKA_BROKER ?? "localhost:9092")
    .split(",").map((b) => b.trim()).filter(Boolean),
};
