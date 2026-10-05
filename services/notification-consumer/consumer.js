require("dotenv").config();
const { Kafka, logLevel } = require("kafkajs");
const { INQUIRY_CREATED } = require("./topics");

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "notification-consumer",
  brokers: [BROKER],
  logLevel: logLevel.ERROR,
});

const consumer = kafka.consumer({ groupId: "notification-service" });

/**
 * Simulates whatever a real notification service would do with an inquiry
 * event — send an email, push a mobile notification, log to an analytics
 * pipeline, etc. Kept as a console log here since the point of this service
 * is to demonstrate the event-driven wiring (producer → broker → consumer),
 * not to stand up a real email provider for a portfolio project.
 */
function handleInquiryEvent(event) {
  const { event: eventType, inquiryId, propertyId, buyerId, agentId, emittedAt } = event;

  switch (eventType) {
    case "inquiry.created":
      console.log(
        `[notify] New inquiry ${inquiryId} on property ${propertyId} — ` +
          `would notify agent ${agentId} that buyer ${buyerId} reached out. (emitted ${emittedAt})`
      );
      break;
    case "inquiry.reopened":
      console.log(
        `[notify] Inquiry ${inquiryId} reopened on property ${propertyId} — ` +
          `would notify agent ${agentId} of a new message from buyer ${buyerId}. (emitted ${emittedAt})`
      );
      break;
    default:
      console.log(`[notify] Unrecognized inquiry event type: ${eventType}`, event);
  }
}

async function main() {
  await consumer.connect();
  console.log(`notification-consumer: connected to Kafka broker at ${BROKER}`);

  await consumer.subscribe({ topic: INQUIRY_CREATED, fromBeginning: false });
  console.log(`notification-consumer: subscribed to "${INQUIRY_CREATED}"`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        handleInquiryEvent(event);
      } catch (err) {
        console.error("notification-consumer: failed to process message:", err.message);
      }
    },
  });
}

main().catch((err) => {
  console.error("notification-consumer: failed to start:", err.message);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await consumer.disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
