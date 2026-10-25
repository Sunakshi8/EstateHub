import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { MulterError } from "multer";
import { env } from "../config/env";
import { logger } from "../config/logger";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ message: "Invalid id" });
  if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: err.message });
  if (err instanceof MulterError) return res.status(400).json({ message: err.message });

  logger.error({ err, correlationId: req.correlationId, path: req.path }, "unhandled error");
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = env.isProd && status === 500 ? "Server error" : err?.message ?? "Server error";
  return res.status(status).json({ message });
};
