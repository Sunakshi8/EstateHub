import pino from "pino";
import { config } from "./config";

export const logger = pino({
  level: config.NODE_ENV === "test" ? "silent" : config.LOG_LEVEL,
  base: { service: "notification-consumer" },
});
