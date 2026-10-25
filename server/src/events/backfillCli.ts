import { connectMongo, disconnectMongo } from "../config/db";
import { initPostgres, closePostgres } from "../config/postgres";
import { logger } from "../config/logger";
import { backfillPropertySnapshots } from "./backfill";
import { shutdownProducer } from "./producer";

async function main() {
  await connectMongo();
  await initPostgres();
  const n = await backfillPropertySnapshots();
  logger.info({ count: n }, "backfill complete");
  await shutdownProducer();
  await disconnectMongo();
  await closePostgres();
}

main().catch((err) => {
  logger.error({ err }, "backfill failed");
  process.exit(1);
});
