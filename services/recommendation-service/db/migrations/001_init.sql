-- Recommendation service schema. Everything lives in its own `reco` schema:
-- the service owns this data; no other service writes to it.
CREATE SCHEMA IF NOT EXISTS reco;

-- Idempotency ledger. Kafka is at-least-once, so the same event can arrive
-- twice. (consumer, event_id) is inserted in the SAME transaction as the
-- state change it protects, so a duplicate is detected and skipped atomically.
CREATE TABLE IF NOT EXISTS reco.processed_events (
  consumer      TEXT        NOT NULL,
  event_id      UUID        NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);

-- Read model of property attributes, fed by `property.upserted` events.
CREATE TABLE IF NOT EXISTS reco.property_features (
  property_id        TEXT PRIMARY KEY,
  owner_id           TEXT          NOT NULL,
  moderation_status  TEXT          NOT NULL,
  booking_status     TEXT          NOT NULL,
  price              NUMERIC(14,2) NOT NULL,
  price_band         INT           NOT NULL,
  city               TEXT          NOT NULL,
  locality           TEXT          NOT NULL DEFAULT '',
  property_type      TEXT          NOT NULL,
  bedrooms           INT           NOT NULL DEFAULT 0,
  furnishing         TEXT          NOT NULL,
  amenities          TEXT[]        NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_features_candidates_idx
  ON reco.property_features (moderation_status, booking_status, updated_at DESC);

-- Append-only log of user<->property interactions (views, favorites, inquiries).
-- `applied = false` means the property's features weren't known yet when the
-- interaction arrived; it is applied as soon as the property event shows up.
CREATE TABLE IF NOT EXISTS reco.interactions (
  id           BIGSERIAL        PRIMARY KEY,
  event_id     UUID             NOT NULL UNIQUE,
  user_id      TEXT             NOT NULL,
  property_id  TEXT             NOT NULL,
  kind         TEXT             NOT NULL,
  weight       DOUBLE PRECISION NOT NULL,
  occurred_at  TIMESTAMPTZ      NOT NULL,
  applied      BOOLEAN          NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS interactions_user_idx ON reco.interactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS interactions_pending_idx ON reco.interactions (property_id) WHERE NOT applied;
CREATE INDEX IF NOT EXISTS interactions_popularity_idx ON reco.interactions (occurred_at, property_id) WHERE weight > 0;

-- THE PREFERENCE SCORES. One row per (user, feature). `score` is the
-- exponentially-decayed sum of interaction weights as of `updated_at`; it is
-- decayed forward to "now" at read time (see src/scoring/score.ts).
CREATE TABLE IF NOT EXISTS reco.user_preferences (
  user_id        TEXT             NOT NULL,
  feature_type   TEXT             NOT NULL,   -- city | locality | property_type | price_band | bedrooms | furnishing | amenity
  feature_value  TEXT             NOT NULL,
  score          DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (score >= 0),
  updated_at     TIMESTAMPTZ      NOT NULL,
  PRIMARY KEY (user_id, feature_type, feature_value)
);
CREATE INDEX IF NOT EXISTS user_preferences_top_idx ON reco.user_preferences (user_id, score DESC);
