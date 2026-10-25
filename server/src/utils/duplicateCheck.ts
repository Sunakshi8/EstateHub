import { Types } from "mongoose";
import { Property } from "../models/Property";
import { escapeRegex } from "./escapeRegex";

export interface DuplicateArgs {
  address?: string;
  city?: string;
  price: number;
  contactPhone?: string;
}

/**
 * In-process fallback duplicate detection (used when the gRPC service is
 * unreachable): same city + same address (case-insensitive) + price within
 * ±5% + same contact phone as an existing listing.
 */
export async function findDuplicate(
  { address, city, price, contactPhone }: DuplicateArgs,
  excludeId: string | null = null
): Promise<string | null> {
  if (!address || !city) return null;

  const query: Record<string, unknown> = {
    "location.address": new RegExp(`^${escapeRegex(address.trim())}$`, "i"),
    "location.city": new RegExp(`^${escapeRegex(city.trim())}$`, "i"),
    price: { $gte: price * 0.95, $lte: price * 1.05 },
  };
  if (contactPhone) query.contactPhone = contactPhone;
  if (excludeId && Types.ObjectId.isValid(excludeId)) query._id = { $ne: new Types.ObjectId(excludeId) };

  const match = await Property.findOne(query).select("_id");
  return match ? match._id.toHexString() : null;
}
