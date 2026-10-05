// Central place for Kafka topic names so the producer (server) and any
// consumers (services/notification-consumer) never drift out of sync.
module.exports = {
  INQUIRY_CREATED: "estatehub.inquiries",
};
