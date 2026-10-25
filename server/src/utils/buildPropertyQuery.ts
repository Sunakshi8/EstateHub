import type { FilterQuery, SortOrder } from "mongoose";
import type { IProperty } from "../models/Property";
import { escapeRegex } from "./escapeRegex";

export interface PropertyFilters {
  keyword?: string;
  city?: string;
  locality?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  propertyType?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  furnishing?: string;
  amenities?: string | string[];
  bookingStatus?: string;
  sort?: string;
  page?: number | string;
  limit?: number | string;
}

/**
 * Builds the Mongo query, sort option, and pagination values for property
 * search/filtering. Shared by the REST /api/properties endpoint and the
 * GraphQL `properties` query so both stay in sync.
 *
 * User-supplied text is regex-escaped (the JS version interpolated it raw,
 * which allowed regex injection / ReDoS).
 */
export function buildPropertyQuery(filters: PropertyFilters = {}) {
  const {
    keyword, city, locality, minPrice, maxPrice, propertyType, bedrooms,
    bathrooms, furnishing, amenities, bookingStatus, sort, page = 1, limit = 12,
  } = filters;

  const query: FilterQuery<IProperty> = { moderationStatus: "approved" };

  if (keyword) {
    const re = new RegExp(escapeRegex(String(keyword)), "i");
    query.$or = [
      { title: re },
      { "location.city": re },
      { "location.locality": re },
      { description: re },
    ];
  }
  if (city) query["location.city"] = new RegExp(`^${escapeRegex(String(city))}$`, "i");
  if (locality) query["location.locality"] = new RegExp(escapeRegex(String(locality)), "i");
  if (propertyType) query.propertyType = propertyType;
  if (furnishing) query.furnishing = furnishing;
  if (bookingStatus) query.bookingStatus = bookingStatus;
  if (bedrooms) query.bedrooms = { $gte: Number(bedrooms) };
  if (bathrooms) query.bathrooms = { $gte: Number(bathrooms) };
  if (minPrice || maxPrice) {
    const range: { $gte?: number; $lte?: number } = {};
    if (minPrice) range.$gte = Number(minPrice);
    if (maxPrice) range.$lte = Number(maxPrice);
    query.price = range;
  }
  if (amenities) {
    const list = Array.isArray(amenities)
      ? amenities
      : String(amenities).split(",").map((a) => a.trim()).filter(Boolean);
    if (list.length) query.amenities = { $all: list };
  }

  let sortOption: Record<string, SortOrder> = { createdAt: -1 };
  if (sort === "price_asc") sortOption = { price: 1 };
  if (sort === "price_desc") sortOption = { price: -1 };

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
  const skip = (pageNum - 1) * limitNum;

  return { query, sortOption, pageNum, limitNum, skip };
}
