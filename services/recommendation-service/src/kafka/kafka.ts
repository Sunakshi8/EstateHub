import { Kafka, logLevel } from "kafkajs";
import { config } from "../config";

export const kafka = new Kafka({
  clientId: "recommendation-service",
  brokers: config.kafkaBrokers,
  connectionTimeout: 5000,
  retry: { initialRetryTime: 300, retries: 10 },
  logLevel: logLevel.ERROR,
});
