import { Types } from "mongoose";

/** Normalises an ObjectId / populated document / string to its hex string. */
export function idString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (v instanceof Types.ObjectId) return v.toHexString();
  if (typeof v === "object" && "_id" in v) return idString((v as { _id: unknown })._id);
  return String(v);
}
