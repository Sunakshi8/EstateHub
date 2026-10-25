import cors from "cors";
import express from "express";
import http from "node:http";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express4";

import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectMongo, disconnectMongo } from "./config/db";
import { closePostgres, initPostgres, pingPostgres } from "./config/postgres";
import { shutdownProducer, startEventInfrastructure } from "./events/lifecycle";
import { isBrokerHealthy, producerMetrics } from "./events/producer";
import { outboxDepth } from "./events/outbox";

import { errorHandler } from "./middleware/errorHandler";
import { requestContext } from "./middleware/requestContext";
import { uploadDir } from "./middleware/upload";

import adminRoutes from "./routes/adminRoutes";
import authRoutes from "./routes/authRoutes";
import inquiryRoutes from "./routes/inquiryRoutes";
import propertyRoutes from "./routes/propertyRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import uploadRoutes from "./routes/uploadRoutes";

import { resolvers } from "./graphql/resolvers";
import { typeDefs } from "./graphql/typeDefs";

async function startServer(): Promise<void> {
  // MongoDB is the primary store — the API can't run without it.
  await connectMongo();
  // PostgreSQL + Kafka are enhancement layers — failures degrade, not crash.
  await initPostgres();
  startEventInfrastructure();

  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(requestContext);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/uploads", express.static(uploadDir));

  app.get("/api/health", async (_req, res) => {
    const [pg, outbox] = await Promise.all([pingPostgres(), outboxDepth()]);
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      mongo: mongoose.connection.readyState === 1,
      postgres: pg,
      kafkaProducerHealthy: isBrokerHealthy(),
      outboxPending: outbox,
      producer: producerMetrics,
    });
  });

  // --- GraphQL (read-only search API, mounted alongside the REST routes) ---
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  await apolloServer.start();
  app.use("/graphql", cors(), express.json(), expressMiddleware(apolloServer));

  // --- REST API ---
  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertyRoutes);
  app.use("/api/inquiries", inquiryRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/recommendations", recommendationRoutes);

  app.use("/api", (_req, res) => res.status(404).json({ message: "API route not found" }));
  app.use(errorHandler);

  httpServer.listen(env.PORT, () => {
    logger.info(`EstateHub API running on port ${env.PORT}`);
    logger.info(`GraphQL endpoint: http://localhost:${env.PORT}/graphql`);
  });

  // ---- graceful shutdown ----
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await shutdownProducer();
    await closePostgres();
    await disconnectMongo();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => logger.error({ reason }, "unhandled rejection"));

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
