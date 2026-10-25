import type { FeatureType } from "./weights";

export interface FeatureKV {
  type: FeatureType;
  value: string;
}

export interface PropertyFeatures {
  propertyId: string;
  ownerId: string;
  price: number;
  priceBand: number;
  city: string;
  locality: string;
  propertyType: string;
  bedrooms: number;
  furnishing: string;
  amenities: string[];
  updatedAt?: Date;
}

const BAND_BASE = Math.log(1.35);

/** Log-scale price bucket: each band is ~35% wider than the previous. */
export function priceBand(price: number): number {
  return Math.round(Math.log(Math.max(price, 1)) / BAND_BASE);
}

const norm = (s: string) => s.trim().toLowerCase();

/** Flattens a property into the (type, value) pairs preferences are stored under. */
export function extractFeatures(p: PropertyFeatures): FeatureKV[] {
  const out: FeatureKV[] = [
    { type: "city", value: norm(p.city) },
    { type: "property_type", value: norm(p.propertyType) },
    { type: "price_band", value: String(p.priceBand) },
    { type: "bedrooms", value: String(p.bedrooms) },
    { type: "furnishing", value: norm(p.furnishing) },
  ];
  if (p.locality.trim()) out.push({ type: "locality", value: norm(p.locality) });
  for (const a of new Set(p.amenities.map(norm).filter(Boolean))) {
    out.push({ type: "amenity", value: a });
  }
  return out.filter((f) => f.value !== "");
}

/** Features implied by a search filter (no property involved). */
export function featuresFromSearch(filters: {
  city?: string;
  propertyType?: string;
  bedrooms?: number;
  furnishing?: string;
  minPrice?: number;
  maxPrice?: number;
}): FeatureKV[] {
  const out: FeatureKV[] = [];
  if (filters.city) out.push({ type: "city", value: norm(filters.city) });
  if (filters.propertyType) out.push({ type: "property_type", value: norm(filters.propertyType) });
  if (filters.bedrooms !== undefined) out.push({ type: "bedrooms", value: String(filters.bedrooms) });
  if (filters.furnishing) out.push({ type: "furnishing", value: norm(filters.furnishing) });
  if (filters.minPrice || filters.maxPrice) {
    const mid =
      filters.minPrice && filters.maxPrice
        ? Math.sqrt(filters.minPrice * filters.maxPrice) // geometric mean suits a log scale
        : (filters.minPrice ?? filters.maxPrice)!;
    out.push({ type: "price_band", value: String(priceBand(mid)) });
  }
  return out;
}
