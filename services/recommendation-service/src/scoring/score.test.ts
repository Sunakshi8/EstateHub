import { describe, expect, it } from "vitest";
import { extractFeatures, featuresFromSearch, priceBand, type PropertyFeatures } from "./features";
import { buildPrefIndex, decayedScore, rankCandidates, type PrefRow } from "./score";

const NOW = new Date("2026-10-05T00:00:00Z");
const DAY = 86_400_000;

function prop(over: Partial<PropertyFeatures> & { propertyId: string }): PropertyFeatures {
  const price = over.price ?? 8_500_000;
  return {
    ownerId: "owner", price, priceBand: priceBand(price), city: "Shimla", locality: "Chhota Shimla",
    propertyType: "apartment", bedrooms: 3, furnishing: "semi-furnished",
    amenities: ["Parking", "Lift"], updatedAt: NOW, ...over,
  };
}

/** Preference rows as the consumer would have stored them after viewing/favoriting `p`. */
function prefsFrom(p: PropertyFeatures, score: number, at = NOW): PrefRow[] {
  return extractFeatures(p).map((f) => ({
    featureType: f.type, featureValue: f.value, score, updatedAt: at,
  }));
}

describe("decay", () => {
  it("halves every half-life and never grows", () => {
    expect(decayedScore(8, NOW, new Date(NOW.getTime() + 14 * DAY), 14)).toBeCloseTo(4);
    expect(decayedScore(8, NOW, new Date(NOW.getTime() + 28 * DAY), 14)).toBeCloseTo(2);
    expect(decayedScore(8, NOW, new Date(NOW.getTime() - DAY), 14)).toBe(8); // future timestamp: no inflation
  });
});

describe("features", () => {
  it("price bands are log-scale: close prices share/neighbour a band, far prices don't", () => {
    expect(Math.abs(priceBand(8_500_000) - priceBand(9_000_000))).toBeLessThanOrEqual(1);
    expect(priceBand(8_500_000)).toBeLessThan(priceBand(40_000_000));
  });

  it("extracts normalised, de-duplicated features", () => {
    const f = extractFeatures(prop({ propertyId: "a", amenities: ["Parking", "parking", "Lift"] }));
    expect(f.filter((x) => x.type === "amenity").map((x) => x.value).sort()).toEqual(["lift", "parking"]);
    expect(f.find((x) => x.type === "city")?.value).toBe("shimla");
  });

  it("maps search filters to features", () => {
    const f = featuresFromSearch({ city: "Mohali", bedrooms: 4, minPrice: 1e7, maxPrice: 2e7 });
    expect(f.map((x) => x.type).sort()).toEqual(["bedrooms", "city", "price_band"]);
  });
});

describe("ranking", () => {
  const shimla = prop({ propertyId: "shimla" });
  const mohali = prop({
    propertyId: "mohali", city: "Mohali", locality: "Sector 74", propertyType: "house",
    bedrooms: 4, furnishing: "unfurnished", price: 12_500_000, amenities: ["Garden", "Security"],
  });

  it("cold start falls back to popularity", () => {
    const r = rankCandidates(buildPrefIndex([], NOW, 14), [shimla, mohali], new Map([["mohali", 10]]), 5);
    expect(r.source).toBe("popular");
    expect(r.items[0].propertyId).toBe("mohali");
  });

  it("ranks the property matching learned taste first, with reasons", () => {
    const index = buildPrefIndex(prefsFrom(shimla, 10), NOW, 14);
    const r = rankCandidates(index, [mohali, shimla], new Map(), 5);
    expect(r.source).toBe("personalized");
    expect(r.items[0].propertyId).toBe("shimla");
    expect(r.items[0].score).toBeGreaterThan(r.items[1].score);
    expect(r.items[0].reasons.length).toBeGreaterThan(0);
    expect(r.items[0].score).toBeGreaterThan(80); // perfect taste match ≈ 85 + popularity share
  });

  it("recent taste outranks old taste", () => {
    const old = prefsFrom(shimla, 10, new Date(NOW.getTime() - 60 * DAY)); // ~4 half-lives ago
    const fresh = prefsFrom(mohali, 10, NOW);
    const r = rankCandidates(buildPrefIndex([...old, ...fresh], NOW, 14), [shimla, mohali], new Map(), 5);
    expect(r.items[0].propertyId).toBe("mohali");
  });

  it("gives partial credit to neighbouring price bands", () => {
    const base = prop({ propertyId: "base", price: 8_500_000 });
    const nearPrice = prop({ propertyId: "near", price: 8_500_000 * 1.35 });
    const farPrice = prop({ propertyId: "far", price: 8_500_000 * 6 });
    const index = buildPrefIndex(
      prefsFrom(base, 10).filter((r) => r.featureType === "price_band"), NOW, 14
    );
    const r = rankCandidates(index, [farPrice, nearPrice], new Map(), 5);
    expect(r.items[0].propertyId).toBe("near");
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => prop({ propertyId: `p${i}` }));
    expect(rankCandidates(buildPrefIndex([], NOW, 14), many, new Map(), 7).items).toHaveLength(7);
  });
});
