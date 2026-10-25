import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export const generateToken = (userId: unknown): string =>
  jwt.sign({ id: String(userId) }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
