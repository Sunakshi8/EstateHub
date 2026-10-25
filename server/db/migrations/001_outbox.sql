-- Transactional-outbox fallback for Kafka publishing.
-- When the broker is unreachable, events are parked here and a relay drains
-- them (in id order) once Kafka is back, so events survive broker outages
-- and server restarts instead of being dropped.
CREATE TABLE IF NOT EXISTS outbox_events (
  id            BIGSERIAL PRIMARY KEY,
  event_id      UUID        NOT NULL UNIQUE,
  topic         TEXT        NOT NULL,
  message_key   TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  attempts      INT         NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS outbox_unpublished_idx
  ON outbox_events (id) WHERE published_at IS NULL;
