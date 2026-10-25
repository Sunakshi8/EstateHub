import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { env } from "../config/env";
import { logger } from "../config/logger";

const PROTO_PATH = path.resolve(__dirname, "..", "..", "proto", "duplicate.proto");

interface CheckDuplicateRequest {
  address: string;
  city: string;
  price: number;
  contactPhone: string;
  excludeId: string;
}
interface CheckDuplicateResponse {
  isDuplicate: boolean;
  duplicatePropertyId: string;
}
interface DuplicateDetectorClient extends grpc.Client {
  CheckDuplicate(
    req: CheckDuplicateRequest,
    options: grpc.CallOptions,
    cb: (err: grpc.ServiceError | null, res?: CheckDuplicateResponse) => void
  ): void;
}

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  duplicate: { DuplicateDetector: new (addr: string, creds: grpc.ChannelCredentials) => DuplicateDetectorClient };
};

const client = new proto.duplicate.DuplicateDetector(
  env.DUPLICATE_SERVICE_URL,
  grpc.credentials.createInsecure()
);

export interface GrpcDuplicateResult {
  available: boolean;
  duplicateId: string | null;
}

export interface DuplicateCheckInput {
  address?: string;
  city?: string;
  price?: number;
  contactPhone?: string;
  excludeId?: string | null;
}

/**
 * Calls the duplicate-detector gRPC microservice with a 2s deadline.
 * `available: false` means "service unreachable" — callers should fall back to
 * the in-process check (utils/duplicateCheck.ts) instead of failing the request.
 */
export function checkDuplicateViaGrpc(input: DuplicateCheckInput): Promise<GrpcDuplicateResult> {
  return new Promise((resolve) => {
    client.CheckDuplicate(
      {
        address: input.address ?? "",
        city: input.city ?? "",
        price: input.price ?? 0,
        contactPhone: input.contactPhone ?? "",
        excludeId: input.excludeId ? String(input.excludeId) : "",
      },
      { deadline: new Date(Date.now() + 2000) },
      (err, response) => {
        if (err || !response) {
          logger.warn(
            { err: err?.message },
            "duplicate-detector gRPC unavailable, falling back to in-process check"
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
