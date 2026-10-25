import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().default("postgres://estatehub:estatehub@localhost:5432/estatehub"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_REPLICATION_FACTOR: z.coerce.number().int().positive().default(1),
  CONSUMER_GROUP: z.string().default("recommendation-service"),
  HTTP_PORT: z.coerce.number().int().positive().default(5100),
  INTERNAL_API_TOKEN: z.string().min(8).default("dev-internal-token"),
  HALF_LIFE_DAYS: z.coerce.number().positive().default(14),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean),
};
