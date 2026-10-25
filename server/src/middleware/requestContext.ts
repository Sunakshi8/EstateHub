import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

/** Assigns/propagates a correlation id so a request can be traced into Kafka events. */
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  req.correlationId = typeof incoming === "string" && incoming ? incoming : randomUUID();
  res.setHeader("x-request-id", req.correlationId);
  next();
};
