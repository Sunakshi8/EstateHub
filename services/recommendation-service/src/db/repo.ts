import type { PoolClient, Pool } from "pg";
import type { PropertyUpsertedData } from "../shared/schemas";
import { type FeatureKV, type PropertyFeatures, extractFeatures, priceBand } from "../scoring/features";
import type { PrefRow } from "../scoring/score";
import { POPULARITY_WINDOW_DAYS } from "../scoring/weights";

type Q = Pick<PoolClient, "query"> | Pick<Pool, "query">;

// ---- idempotency ------------------------------------------------------------

/** Returns true the first time an event is seen by this consumer, false on a duplicate. */
export async function markProcessed(q: Q, consumer: string, eventId: string): Promise<boolean> {
  const r = await q.query(
    `INSERT INTO reco.processed_events (consumer, event_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [consumer, eventId]
  );
  return (r.rowCount ?? 0) > 0;
}

// ---- property read model ----------------------------------------------------

export async function upsertPropertyFeatures(q: Q, p: PropertyUpsertedData, at: Date): Promise<PropertyFeatures> {
  const band = priceBand(p.price);
  await q.query(
    `INSERT INTO reco.property_features
       (property_id, owner_id, moderation_status, booking_status, price, price_band,
        city, locality, property_type, bedrooms, furnishing, amenities, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (property_id) DO UPDATE SET
       owner_id = EXCLUDED.owner_id, moderation_status = EXCLUDED.moderation_status,
       booking_status = EXCLUDED.booking_status, price = EXCLUDED.price,
       price_band = EXCLUDED.price_band, city = EXCLUDED.city, locality = EXCLUDED.locality,
       property_type = EXCLUDED.property_type, bedrooms = EXCLUDED.bedrooms,
       furnishing = EXCLUDED.furnishing, amenities = EXCLUDED.amenities,
       updated_at = EXCLUDED.updated_at
     WHERE reco.property_features.updated_at <= EXCLUDED.updated_at`, // ignore stale/out-of-order snapshots
    [p.propertyId, p.ownerId, p.moderationStatus, p.bookingStatus, p.price, band,
     p.city, p.locality, p.propertyType, p.bedrooms, p.furnishing, p.amenities, at]
  );
  return {
    propertyId: p.propertyId, ownerId: p.ownerId, price: p.price, priceBand: band,
    city: p.city, locality: p.locality, propertyType: p.propertyType,
    bedrooms: p.bedrooms, furnishing: p.furnishing, amenities: p.amenities, updatedAt: at,
  };
}

export async function removeProperty(q: Q, propertyId: string): Promise<void> {
  await q.query("DELETE FROM reco.property_features WHERE property_id = $1", [propertyId]);
}

interface FeatureRow {
  property_id: string; owner_id: string; price: string; price_band: number; city: string;
  locality: string; property_type: string; bedrooms: number; furnishing: string;
  amenities: string[]; updated_at: Date;
}

const toFeatures = (r: FeatureRow): PropertyFeatures => ({
  propertyId: r.property_id, ownerId: r.owner_id, price: Number(r.price), priceBand: r.price_band,
  city: r.city, locality: r.locality, propertyType: r.property_type, bedrooms: r.bedrooms,
  furnishing: r.furnishing, amenities: r.amenities, updatedAt: r.updated_at,
});

export async function getPropertyFeatures(q: Q, propertyId: string): Promise<PropertyFeatures | null> {
  const r = await q.query<FeatureRow>("SELECT * FROM reco.property_features WHERE property_id = $1", [propertyId]);
  return r.rows[0] ? toFeatures(r.rows[0]) : null;
}

/** Approved + available listings not owned by the user, newest first. */
export async function loadCandidates(q: Q, userId: string, limit = 500): Promise<PropertyFeatures[]> {
  const r = await q.query<FeatureRow>(
    `SELECT * FROM reco.property_features
      WHERE moderation_status = 'approved' AND booking_status = 'available' AND owner_id <> $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return r.rows.map(toFeatures);
}

/** propertyId -> number of positive interactions in the recent window. */
export async function loadPopularity(q: Q): Promise<Map<string, number>> {
  const r = await q.query<{ property_id: string; n: string }>(
    `SELECT property_id, count(*)::text AS n
       FROM reco.interactions
      WHERE weight > 0 AND occurred_at > now() - make_interval(days => $1)
      GROUP BY property_id`,
    [POPULARITY_WINDOW_DAYS]
  );
  return new Map(r.rows.map((x) => [x.property_id, Number(x.n)]));
}

// ---- interactions & preference scores ---------------------------------------

export interface InteractionInput {
  eventId: string;
  userId: string;
  propertyId: string;
  kind: string;
  weight: number;
  occurredAt: Date;
}

export async function insertInteraction(q: Q, i: InteractionInput): Promise<void> {
  await q.query(
    `INSERT INTO reco.interactions (event_id, user_id, property_id, kind, weight, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (event_id) DO NOTHING`,
    [i.eventId, i.userId, i.propertyId, i.kind, i.weight, i.occurredAt]
  );
}

export async function markInteractionApplied(q: Q, eventId: string): Promise<void> {
  await q.query("UPDATE reco.interactions SET applied = true WHERE event_id = $1", [eventId]);
}

/**
 * Adds `weight` to every (user, feature) preference row, in ONE statement.
 *
 *   new_score = old_score * 0.5^(elapsed / half_life) + weight        (floored at 0)
 *
 * i.e. old taste fades with time and the new interaction is added on top.
 * Out-of-order events (older than the stored timestamp) are not decayed
 * backwards: elapsed is clamped at 0 and updated_at only ever moves forward.
 */
export async function bumpPreferences(
  q: Q,
  userId: string,
  features: FeatureKV[],
  weight: number,
  at: Date,
  halfLifeDays: number
): Promise<void> {
  if (features.length === 0) return;
  await q.query(
    `INSERT INTO reco.user_preferences AS up (user_id, feature_type, feature_value, score, updated_at)
     SELECT $1::text, t.feature_type, t.feature_value, GREATEST($4::float8, 0), $5::timestamptz
       FROM unnest($2::text[], $3::text[]) AS t(feature_type, feature_value)
     ON CONFLICT (user_id, feature_type, feature_value) DO UPDATE SET
       score = GREATEST(0,
                 up.score * power(0.5,
                   GREATEST(0, EXTRACT(EPOCH FROM (EXCLUDED.updated_at - up.updated_at)))
                   / ($6::float8 * 86400))
                 + $4::float8),
       updated_at = GREATEST(up.updated_at, EXCLUDED.updated_at)`,
    [userId, features.map((f) => f.type), features.map((f) => f.value), weight, at, halfLifeDays]
  );
}

/** Applies interactions that arrived before their property's features were known. */
export async function applyPendingInteractions(
  q: Q,
  propertyId: string,
  features: PropertyFeatures,
  halfLifeDays: number
): Promise<number> {
  const pending = await q.query<{ event_id: string; user_id: string; weight: number; occurred_at: Date }>(
    `SELECT event_id, user_id, weight, occurred_at FROM reco.interactions
      WHERE property_id = $1 AND NOT applied ORDER BY occurred_at FOR UPDATE`,
    [propertyId]
  );
  const kv = extractFeatures(features);
  for (const row of pending.rows) {
    await bumpPreferences(q, row.user_id, kv, row.weight, row.occurred_at, halfLifeDays);
    await markInteractionApplied(q, row.event_id);
  }
  return pending.rowCount ?? 0;
}

export async function loadPreferences(q: Q, userId: string): Promise<PrefRow[]> {
  const r = await q.query<{ feature_type: string; feature_value: string; score: number; updated_at: Date }>(
    "SELECT feature_type, feature_value, score, updated_at FROM reco.user_preferences WHERE user_id = $1",
    [userId]
  );
  return r.rows.map((x) => ({
    featureType: x.feature_type, featureValue: x.feature_value, score: x.score, updatedAt: x.updated_at,
  }));
}
