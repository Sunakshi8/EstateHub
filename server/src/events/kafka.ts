import { Kafka, logLevel } from "kafkajs";
import { env } from "../config/env";

export const kafka = new Kafka({
  clientId: "estatehub-server",
  brokers: env.kafkaBrokers,
  connectionTimeout: 3000,
  requestTimeout: 10_000,
  retry: { initialRetryTime: 300, retries: 6 },
  logLevel: logLevel.ERROR, // our own structured logs cover the useful signal
});
