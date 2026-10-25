import "dotenv/config";
import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import mongoose from "mongoose";
import pino from "pino";

const logger = pino({ base: { service: "duplicate-detector" } });

const PROTO_PATH = path.resolve(__dirname, "..", "proto", "duplicate.proto");
const MONGO_URI = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/estatehub";
const PORT = process.env.GRPC_PORT ?? "50051";

interface CheckDuplicateRequest {
  address: string;
  city: string;
  price: number | string;
  contactPhone: string;
  excludeId: string;
}
interface CheckDuplicateResponse {
  isDuplicate: boolean;
  duplicatePropertyId: string;
}

const definition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const proto = grpc.loadPackageDefinition(definition) as unknown as {
  duplicate: { DuplicateDetector: { service: grpc.ServiceDefinition } };
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * gRPC handler for DuplicateDetector.CheckDuplicate.
 *
 * Reads the shared "properties" collection through the native driver (not a
 * full Mongoose model): this service only needs a few fields and shouldn't
 * own or duplicate the Property schema the main API owns.
 */
async function checkDuplicate(
  call: grpc.ServerUnaryCall<CheckDuplicateRequest, CheckDuplicateResponse>,
  callback: grpc.sendUnaryData<CheckDuplicateResponse>
): Promise<void> {
  try {
    const { address, city, price, contactPhone, excludeId } = call.request;

    if (!address || !city) return callback(null, { isDuplicate: false, duplicatePropertyId: "" });

    const priceNum = Number(price) || 0;
    const query: Record<string, unknown> = {
      "location.address": new RegExp(`^${escapeRegex(address.trim())}$`, "i"),
      "location.city": new RegExp(`^${escapeRegex(city.trim())}$`, "i"),
      price: { $gte: priceNum * 0.95, $lte: priceNum * 1.05 },
    };
    if (contactPhone) query.contactPhone = contactPhone;
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const match = await mongoose.connection.collection("properties").findOne(query);
    callback(null, { isDuplicate: !!match, duplicatePropertyId: match ? String(match._id) : "" });
  } catch (err) {
    logger.error({ err }, "CheckDuplicate failed");
    callback({ code: grpc.status.INTERNAL, message: (err as Error).message }, null);
  }
}

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  logger.info("connected to MongoDB");

  const server = new grpc.Server();
  server.addService(proto.duplicate.DuplicateDetector.service, { CheckDuplicate: checkDuplicate });

  await new Promise<void>((resolve, reject) =>
    server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err) =>
      err ? reject(err) : resolve()
    )
  );
  logger.info({ port: PORT }, "gRPC service listening");

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.tryShutdown(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "failed to start");
  process.exit(1);
});
