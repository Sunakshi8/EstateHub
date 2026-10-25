// ============================================================================
// SOURCE OF TRUTH for Kafka event contracts. Edit here, then run
// `npm run sync:shared` from the repo root.
//
// Every message on every topic is an *envelope* with a fixed shape:
//   { eventId, type, version, occurredAt, producer, correlationId?, data }
// validated with zod on both the producing and the consuming side.
// ============================================================================
import { z } from "zod";
import { Topics, type Topic } from "./topics";

export const EVENT_VERSION = 1 as const;

const id = z.string().min(1);

const envelope = {
  eventId: z.string().uuid(),
  version: z.literal(EVENT_VERSION),
  occurredAt: z.string().datetime(),
  producer: z.string().min(1),
  correlationId: z.string().optional(),
};

function event<T extends string, D extends z.ZodTypeAny>(type: T, data: D) {
  return z.object({ ...envelope, type: z.literal(type), data });
}

const inquiryData = z.object({
  inquiryId: id,
  propertyId: id,
  buyerId: id,
  agentId: id,
  inquiryType: z.enum(["general", "site-visit"]),
});

const userPropertyData = z.object({ userId: id, propertyId: id });

const searchData = z.object({
  userId: id,
  filters: z.object({
    city: z.string().optional(),
    propertyType: z.string().optional(),
    bedrooms: z.number().int().optional(),
    furnishing: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
  }),
});

const propertyUpsertedData = z.object({
  propertyId: id,
  ownerId: id,
  moderationStatus: z.enum(["pending", "approved", "rejected"]),
  bookingStatus: z.enum(["available", "booked", "sold", "rented"]),
  price: z.number().nonnegative(),
  city: z.string(),
  locality: z.string(),
  propertyType: z.string(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  area: z.number().nonnegative(),
  furnishing: z.string(),
  amenities: z.array(z.string()),
});

export const EventSchema = z.discriminatedUnion("type", [
  event("inquiry.created", inquiryData),
  event("inquiry.reopened", inquiryData),
  event("property.viewed", userPropertyData),
  event("property.favorited", userPropertyData),
  event("property.unfavorited", userPropertyData),
  event("search.performed", searchData),
  event("property.upserted", propertyUpsertedData),
  event("property.removed", z.object({ propertyId: id })),
]);

export type EstateEvent = z.infer<typeof EventSchema>;
export type EventType = EstateEvent["type"];
export type EventOf<T extends EventType> = Extract<EstateEvent, { type: T }>;
export type EventData<T extends EventType> = EventOf<T>["data"];
export type PropertyUpsertedData = EventData<"property.upserted">;

/** All event types this contract version knows about. */
export const EVENT_TYPES: ReadonlySet<string> = new Set(
  EventSchema.options.map((o) => o.shape.type.value)
);

/** Which topic each event type is published to. */
export const TOPIC_FOR_EVENT: Record<EventType, Topic> = {
  "inquiry.created": Topics.INQUIRIES,
  "inquiry.reopened": Topics.INQUIRIES,
  "property.viewed": Topics.INTERACTIONS,
  "property.favorited": Topics.INTERACTIONS,
  "property.unfavorited": Topics.INTERACTIONS,
  "search.performed": Topics.INTERACTIONS,
  "property.upserted": Topics.PROPERTIES,
  "property.removed": Topics.PROPERTIES,
};

/**
 * Partition key per event. Kafka guarantees ordering only within a partition,
 * so we key by the entity whose ordering matters.
 */
export function partitionKey(e: EstateEvent): string {
  switch (e.type) {
    case "inquiry.created":
    case "inquiry.reopened":
      return e.data.buyerId;
    case "property.viewed":
    case "property.favorited":
    case "property.unfavorited":
    case "search.performed":
      return e.data.userId;
    case "property.upserted":
    case "property.removed":
      return e.data.propertyId;
  }
}
