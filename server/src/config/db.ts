import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export async function connectMongo(): Promise<void> {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info({ host: conn.connection.host }, "MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection error");
    process.exit(1);
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.connection.close();
}
