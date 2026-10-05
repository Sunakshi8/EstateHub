const { Kafka, Partitioners, logLevel } = require("kafkajs");

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "estatehub-server",
  brokers: [BROKER],
  retry: { retries: 2 }, // fail fast rather than retrying for a long time
  // ERROR only — our own try/catch below already logs a clean one-line
  // warning when the broker is unreachable, so we don't need kafkajs's
  // own verbose per-retry connection logs on top of that.
  logLevel: logLevel.ERROR,
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner, // avoids the v2 default-partitioner migration warning
});

let connectPromise = null;

/**
 * Connects the shared producer exactly once, lazily, the first time
 * publishEvent() is called — so a dev running the app without Kafka up
 * doesn't pay any startup cost or see errors until something actually
 * tries to publish.
 */
function ensureConnected() {
  if (!connectPromise) {
    connectPromise = producer.connect().catch((err) => {
      connectPromise = null; // allow retrying on the next publish attempt
      throw err;
    });
  }
  return connectPromise;
}

/**
 * Publishes an event to Kafka. Never throws — if Kafka is unreachable
 * (e.g. running the app locally without `docker compose up`), this logs a
 * warning and the caller's request still succeeds. Event streaming here is
 * an enhancement (analytics/notifications), not something the core flow
 * (sending an inquiry) should ever depend on to function.
 */
async function publishEvent(topic, payload) {
  try {
    await ensureConnected();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify({ ...payload, emittedAt: new Date().toISOString() }) }],
    });
  } catch (err) {
    console.warn(`Kafka publish to "${topic}" skipped (broker unavailable):`, err.message);
  }
}

module.exports = { publishEvent };
