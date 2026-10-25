import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : process.env.LOG_LEVEL ?? "info",
  base: { service: "estatehub-server" },
  redact: ["req.headers.authorization", "password"],
});
