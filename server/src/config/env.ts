import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/estatehub"),
  DATABASE_URL: z.string().default("postgres://estatehub:estatehub@localhost:5432/estatehub"),
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_BROKER: z.string().optional(), // legacy single-broker name, still honoured
  KAFKA_REPLICATION_FACTOR: z.coerce.number().int().positive().default(1),
  DUPLICATE_SERVICE_URL: z.string().default("localhost:50051"),
  RECOMMENDATION_SERVICE_URL: z.string().default("http://localhost:5100"),
  INTERNAL_API_TOKEN: z.string().default("dev-internal-token"),
  UPLOAD_DIR: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === "production",
  kafkaBrokers: (raw.KAFKA_BROKERS ?? raw.KAFKA_BROKER ?? "localhost:9092")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean),
};
