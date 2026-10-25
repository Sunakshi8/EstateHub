// End-to-end test of Kafka-event -> PostgreSQL -> preference score, minus the
// broker itself (events are fed straight into the handler the consumer calls).
// Runs only when TEST_DATABASE_URL points at a disposable PostgreSQL:
//   TEST_DATABASE_URL=postgres://user:pw@localhost:5432/estatehub_test npm test
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, runMigrations } from "./db/pool";
import { loadCandidates, loadPopularity, loadPreferences } from "./db/repo";
import { handleEvent } from "./kafka/handlers";
import { buildPrefIndex, rankCandidates } from "./scoring/score";
import type { EstateEvent } from "./shared/schemas";

const enabled = !!process.env.TEST_DATABASE_URL;
const ctx = { topic: "t", partition: 0, offset: "0", attempt: 1 };
const DAY = 86_400_000;

const env = <T extends EstateEvent["type"]>(
  type: T, data: Extract<EstateEvent, { type: T }>["data"], opts: { at?: Date; eventId?: string } = {}
) =>
  ({
    eventId: opts.eventId ?? randomUUID(), type, version: 1,
    occurredAt: (opts.at ?? new Date()).toISOString(), producer: "test", data,
  }) as unknown as EstateEvent;

const upsert = (propertyId: string, over: Record<string, unknown> = {}, at?: Date) =>
  env("property.upserted", {
    propertyId, ownerId: "agent1", moderationStatus: "approved", bookingStatus: "available",
    price: 8_500_000, city: "Shimla", locality: "Chhota Shimla", propertyType: "apartment",
    bedrooms: 3, bathrooms: 2, area: 1400, furnishing: "semi-furnished", amenities: ["Parking", "Lift"],
    ...over,
  } as never, { at });

const view = (userId: string, propertyId: string, at?: Date, eventId?: string) =>
  env("property.viewed", { userId, propertyId }, { at, eventId });

async function pref(userId: string, type: string, value: string) {
  const r = await pool.query<{ score: number; updated_at: Date }>(
    "SELECT score, updated_at FROM reco.user_preferences WHERE user_id=$1 AND feature_type=$2 AND feature_value=$3",
    [userId, type, value]
  );
  return r.rows[0];
}

describe.skipIf(!enabled)("preference pipeline (PostgreSQL)", () => {
  beforeAll(async () => {
    await runMigrations();
    await runMigrations(); // idempotent
  });
  afterAll(async () => { await pool.end(); });
  beforeEach(async () => {
    await pool.query("TRUNCATE reco.processed_events, reco.property_features, reco.interactions, reco.user_preferences");
  });

  it("accumulates preference scores from weighted interactions", async () => {
    await handleEvent(upsert("p1"), ctx);
    await handleEvent(view("u1", "p1"), ctx);
    await handleEvent(view("u1", "p1"), ctx);
    await handleEvent(env("property.favorited", { userId: "u1", propertyId: "p1" }), ctx);
    // view(1) + view(1) + favorite(4)
    expect((await pref("u1", "city", "shimla")).score).toBeCloseTo(6, 5);
    expect((await pref("u1", "amenity", "parking")).score).toBeCloseTo(6, 5);
  });

  it("is idempotent: a redelivered event changes nothing", async () => {
    await handleEvent(upsert("p1"), ctx);
    const v = view("u1", "p1", undefined, randomUUID());
    await handleEvent(v, ctx);
    await handleEvent(v, ctx);
    await handleEvent(v, ctx);
    expect((await pref("u1", "city", "shimla")).score).toBeCloseTo(1, 5);
    const n = await pool.query("SELECT count(*)::int AS n FROM reco.interactions");
    expect(n.rows[0].n).toBe(1);
  });

  it("decays old taste in SQL before adding a new interaction", async () => {
    await handleEvent(upsert("p1"), ctx);
    await handleEvent(env("property.favorited", { userId: "u1", propertyId: "p1" }, { at: new Date(Date.now() - 14 * DAY) }), ctx);
    await handleEvent(view("u1", "p1", new Date()), ctx);
    // 4 decayed by one half-life (=2) + 1 new view = 3
    expect((await pref("u1", "city", "shimla")).score).toBeCloseTo(3, 1);
  });

  it("never moves timestamps backwards on out-of-order events, and floors at zero", async () => {
    await handleEvent(upsert("p1"), ctx);
    const t1 = new Date();
    await handleEvent(view("u1", "p1", t1), ctx);
    await handleEvent(view("u1", "p1", new Date(t1.getTime() - 3 * DAY)), ctx); // late arrival
    const row = await pref("u1", "city", "shimla");
    expect(row.updated_at.getTime()).toBeCloseTo(t1.getTime(), -2);
    expect(row.score).toBeCloseTo(2, 5);

    await handleEvent(env("property.unfavorited", { userId: "u1", propertyId: "p1" }), ctx); // -3
    expect((await pref("u1", "city", "shimla")).score).toBe(0);
  });

  it("buffers interactions that arrive before the property is known, then applies them", async () => {
    await handleEvent(view("u1", "late"), ctx);
    expect(await pref("u1", "city", "shimla")).toBeUndefined();
    await handleEvent(upsert("late"), ctx);
    expect((await pref("u1", "city", "shimla")).score).toBeCloseTo(1, 5);
    const pending = await pool.query("SELECT count(*)::int AS n FROM reco.interactions WHERE NOT applied");
    expect(pending.rows[0].n).toBe(0);
  });

  it("learns from searches and weights inquiries above views", async () => {
    await handleEvent(env("search.performed", { userId: "u2", filters: { city: "Mohali", bedrooms: 4 } }), ctx);
    expect((await pref("u2", "city", "mohali")).score).toBeCloseTo(0.5, 5);

    await handleEvent(upsert("p1"), ctx);
    await handleEvent(env("inquiry.created", {
      inquiryId: "i1", propertyId: "p1", buyerId: "u2", agentId: "agent1", inquiryType: "site-visit",
    }), ctx);
    expect((await pref("u2", "city", "shimla")).score).toBeCloseTo(10, 5);
  });

  it("recommends the matching listing first, excludes own + unapproved listings", async () => {
    await handleEvent(upsert("shimla1"), ctx);
    await handleEvent(upsert("shimla2", { price: 9_000_000 }), ctx);
    await handleEvent(upsert("mohali1", { city: "Mohali", locality: "Sector 74", propertyType: "house", bedrooms: 4, furnishing: "unfurnished", price: 12_500_000, amenities: ["Garden"] }), ctx);
    await handleEvent(upsert("pending1", { moderationStatus: "pending" }), ctx);
    await handleEvent(upsert("mine", { ownerId: "u1" }), ctx);

    for (let i = 0; i < 3; i++) await handleEvent(view("u1", "shimla1"), ctx);

    const [prefRows, candidates, popularity] = await Promise.all([
      loadPreferences(pool, "u1"), loadCandidates(pool, "u1"), loadPopularity(pool),
    ]);
    const ids = candidates.map((c) => c.propertyId).sort();
    expect(ids).toEqual(["mohali1", "shimla1", "shimla2"]); // no pending, no own listing

    const r = rankCandidates(buildPrefIndex(prefRows, new Date(), 14), candidates, popularity, 5);
    expect(r.source).toBe("personalized");
    expect(r.items.map((i) => i.propertyId)).toEqual(expect.arrayContaining(["shimla1", "shimla2", "mohali1"]));
    expect(r.items[2].propertyId).toBe("mohali1"); // the non-matching city ranks last
    expect(r.items[0].reasons.length).toBeGreaterThan(0);
  });

  it("removing a property takes it out of the candidate pool", async () => {
    await handleEvent(upsert("p1"), ctx);
    await handleEvent(env("property.removed", { propertyId: "p1" }), ctx);
    expect(await loadCandidates(pool, "nobody")).toHaveLength(0);
  });
});
