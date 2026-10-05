const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = path.join(__dirname, "..", "proto", "duplicate.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const duplicateProto = grpc.loadPackageDefinition(packageDefinition).duplicate;

const GRPC_ADDRESS = process.env.DUPLICATE_SERVICE_URL || "localhost:50051";

const client = new duplicateProto.DuplicateDetector(
  GRPC_ADDRESS,
  grpc.credentials.createInsecure()
);

/**
 * Calls the duplicate-detector gRPC microservice.
 *
 * Returns { available: true, duplicateId } when the service responded
 * normally (duplicateId is null if no match was found), or
 * { available: false, duplicateId: null } if the service couldn't be
 * reached in time — callers should fall back to the in-process check
 * (utils/duplicateCheck.js) in that case rather than failing the request.
 * A student-project microservice going down should never block someone
 * from listing a property.
 */
function checkDuplicateViaGrpc({ address, city, price, contactPhone, excludeId }) {
  return new Promise((resolve) => {
    const deadline = new Date(Date.now() + 2000); // 2s budget before falling back

    client.CheckDuplicate(
      {
        address: address || "",
        city: city || "",
        price: price || 0,
        contactPhone: contactPhone || "",
        excludeId: excludeId ? String(excludeId) : "",
      },
      { deadline },
      (err, response) => {
        if (err) {
          console.warn(
            "duplicate-detector gRPC service unavailable, falling back to in-process check:",
            err.message
          );
          return resolve({ available: false, duplicateId: null });
        }
        resolve({
          available: true,
          duplicateId: response.isDuplicate ? response.duplicatePropertyId : null,
        });
      }
    );
  });
}

module.exports = { checkDuplicateViaGrpc };
