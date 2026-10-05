require("dotenv").config();
const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const mongoose = require("mongoose");

const PROTO_PATH = path.join(__dirname, "proto", "duplicate.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const duplicateProto = grpc.loadPackageDefinition(packageDefinition).duplicate;

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/estatehub";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * gRPC handler for DuplicateDetector.CheckDuplicate.
 *
 * Reads directly from the shared "properties" collection via the native
 * driver (not a full Mongoose model) since this service only ever reads a
 * few fields and has no reason to own or duplicate the Property schema
 * that the main API already owns.
 */
async function checkDuplicate(call, callback) {
  try {
    const { address, city, price, contactPhone, excludeId } = call.request;

    if (!address || !city) {
      return callback(null, { isDuplicate: false, duplicatePropertyId: "" });
    }

    const priceNum = Number(price) || 0;
    const priceMin = priceNum * 0.95;
    const priceMax = priceNum * 1.05;

    const query = {
      "location.address": new RegExp(`^${escapeRegex(address.trim())}$`, "i"),
      "location.city": new RegExp(`^${escapeRegex(city.trim())}$`, "i"),
      price: { $gte: priceMin, $lte: priceMax },
    };
    if (contactPhone) query.contactPhone = contactPhone;
    if (excludeId) {
      try {
        query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
      } catch {
        // malformed id — ignore the exclusion rather than fail the whole check
      }
    }

    const match = await mongoose.connection.collection("properties").findOne(query);

    callback(null, {
      isDuplicate: !!match,
      duplicatePropertyId: match ? String(match._id) : "",
    });
  } catch (err) {
    callback(err, null);
  }
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("duplicate-detector: connected to MongoDB");

  const server = new grpc.Server();
  server.addService(duplicateProto.DuplicateDetector.service, {
    CheckDuplicate: checkDuplicate,
  });

  const PORT = process.env.GRPC_PORT || 50051;
  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err) => {
    if (err) {
      console.error("duplicate-detector: failed to bind gRPC port:", err.message);
      process.exit(1);
    }
    console.log(`duplicate-detector: gRPC service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("duplicate-detector: failed to start:", err.message);
  process.exit(1);
});
