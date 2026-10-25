import { type PropertyFeatures, extractFeatures } from "./features";
import {
  ADJACENT_PRICE_BAND_CREDIT,
  FEATURE_WEIGHTS,
  PREFERENCE_SHARE,
  TOTAL_FEATURE_WEIGHT,
  type FeatureType,
} from "./weights";

export interface PrefRow {
  featureType: string;
  featureValue: string;
  score: number;
  updatedAt: Date;
}

export interface PrefIndex {
  byType: Map<string, Map<string, number>>;
  maxByType: Map<string, number>;
  size: number;
}

/** Exponential time decay: a score loses half its value every `halfLifeDays`. */
export function decayedScore(score: number, updatedAt: Date, now: Date, halfLifeDays: number): number {
  const elapsedMs = Math.max(0, now.getTime() - updatedAt.getTime());
  return score * 0.5 ** (elapsedMs / (halfLifeDays * 86_400_000));
}

/** Decays every stored preference forward to `now` and indexes it for scoring. */
export function buildPrefIndex(rows: PrefRow[], now: Date, halfLifeDays: number): PrefIndex {
  const byType = new Map<string, Map<string, number>>();
  const maxByType = new Map<string, number>();
  let size = 0;
  for (const r of rows) {
    const s = decayedScore(r.score, r.updatedAt, now, halfLifeDays);
    if (s <= 1e-9) continue;
    let m = byType.get(r.featureType);
    if (!m) byType.set(r.featureType, (m = new Map()));
    m.set(r.featureValue, s);
    maxByType.set(r.featureType, Math.max(maxByType.get(r.featureType) ?? 0, s));
    size++;
  }
  return { byType, maxByType, size };
}

/** Preference for one feature value, normalised to 0..1 within its type. */
function affinity(index: PrefIndex, type: string, value: string): number {
  const max = index.maxByType.get(type);
  if (!max) return 0;
  return (index.byType.get(type)?.get(value) ?? 0) / max;
}

export interface Contribution {
  type: FeatureType;
  value: string;
  points: number;
}

export interface PreferenceMatch {
  /** 0..1 — how well the property matches the user's learned taste. */
  match: number;
  contributions: Contribution[];
}

/** The "preference score": weighted match between a property and a user's learned taste. */
export function preferenceMatch(index: PrefIndex, p: PropertyFeatures): PreferenceMatch {
  const contributions: Contribution[] = [];
  const add = (type: FeatureType, value: string, a: number) => {
    contributions.push({ type, value, points: FEATURE_WEIGHTS[type] * a });
  };

  add("city", p.city.trim().toLowerCase(), affinity(index, "city", p.city.trim().toLowerCase()));
  if (p.locality.trim()) {
    const v = p.locality.trim().toLowerCase();
    add("locality", v, affinity(index, "locality", v));
  }
  const ptype = p.propertyType.trim().toLowerCase();
  add("property_type", ptype, affinity(index, "property_type", ptype));
  add("bedrooms", String(p.bedrooms), affinity(index, "bedrooms", String(p.bedrooms)));
  const furn = p.furnishing.trim().toLowerCase();
  add("furnishing", furn, affinity(index, "furnishing", furn));

  // Price: exact band plus partial credit for neighbouring bands, capped at 1.
  const exact = affinity(index, "price_band", String(p.priceBand));
  const near =
    affinity(index, "price_band", String(p.priceBand - 1)) +
    affinity(index, "price_band", String(p.priceBand + 1));
  add("price_band", String(p.priceBand), Math.min(1, exact + ADJACENT_PRICE_BAND_CREDIT * near));

  // Amenities: average affinity across the property's amenities.
  const amenities = [...new Set(p.amenities.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (amenities.length) {
    const avg = amenities.reduce((sum, a) => sum + affinity(index, "amenity", a), 0) / amenities.length;
    const best = amenities.reduce((b, a) => (affinity(index, "amenity", a) > affinity(index, "amenity", b) ? a : b));
    add("amenity", best, avg);
  }

  const total = contributions.reduce((s, c) => s + c.points, 0);
  return { match: total / TOTAL_FEATURE_WEIGHT, contributions };
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function explain(c: Contribution): string {
  switch (c.type) {
    case "city": return `You've been looking at ${titleCase(c.value)}`;
    case "locality": return `You've shown interest in ${titleCase(c.value)}`;
    case "property_type": return `Matches your interest in ${c.value} listings`;
    case "price_band": return "Within the price range you usually look at";
    case "bedrooms": return `${c.value}-bedroom, like homes you've explored`;
    case "furnishing": return `${titleCase(c.value)}, as you tend to prefer`;
    case "amenity": return `Has amenities you like (${c.value})`;
  }
}

export interface Recommendation {
  propertyId: string;
  score: number; // 0..100
  reasons: string[];
}

export interface RankResult {
  source: "personalized" | "popular";
  items: Recommendation[];
}

/**
 * Ranks candidate properties for one user.
 *   personalized: 85% preference match + 15% popularity, with explanations
 *   popular     : cold start (no learned preferences) -> popularity, then recency
 * `popularity` maps propertyId -> recent positive-interaction count.
 */
export function rankCandidates(
  index: PrefIndex,
  candidates: PropertyFeatures[],
  popularity: Map<string, number>,
  limit: number
): RankResult {
  const maxPop = Math.max(0, ...candidates.map((c) => popularity.get(c.propertyId) ?? 0));
  const popNorm = (id: string) => (maxPop > 0 ? Math.log1p(popularity.get(id) ?? 0) / Math.log1p(maxPop) : 0);
  const recency = (c: PropertyFeatures) => c.updatedAt?.getTime() ?? 0;

  if (index.size === 0) {
    const items = [...candidates]
      .sort((a, b) => popNorm(b.propertyId) - popNorm(a.propertyId) || recency(b) - recency(a))
      .slice(0, limit)
      .map((c) => ({
        propertyId: c.propertyId,
        score: Math.round(popNorm(c.propertyId) * 1000) / 10,
        reasons: popNorm(c.propertyId) > 0 ? ["Popular with other buyers right now"] : [],
      }));
    return { source: "popular", items };
  }

  const scored = candidates.map((c) => {
    const { match, contributions } = preferenceMatch(index, c);
    const final = PREFERENCE_SHARE * match + (1 - PREFERENCE_SHARE) * popNorm(c.propertyId);
    const reasons = contributions
      .filter((x) => x.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2)
      .map(explain);
    return { c, final, reasons };
  });

  scored.sort((a, b) => b.final - a.final || recency(b.c) - recency(a.c));
  return {
    source: "personalized",
    items: scored.slice(0, limit).map(({ c, final, reasons }) => ({
      propertyId: c.propertyId,
      score: Math.round(final * 1000) / 10,
      reasons,
    })),
  };
}

export { extractFeatures };
