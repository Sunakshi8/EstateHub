import { describe, expect, it } from "vitest";
import { buildEvent } from "./producer";
import { EventSchema, EVENT_TYPES, TOPIC_FOR_EVENT, partitionKey } from "./shared/schemas";
import { Topics, TOPIC_SPECS, dlqTopic } from "./shared/topics";

describe("event contracts", () => {
  it("buildEvent produces an envelope that passes the schema", () => {
    const e = buildEvent("property.viewed", { userId: "u1", propertyId: "p1" }, "corr-1");
    expect(EventSchema.safeParse(e).success).toBe(true);
    expect(e.correlationId).toBe("corr-1");
    expect(e.version).toBe(1);
  });

  it("rejects malformed payloads", () => {
    const e = buildEvent("property.viewed", { userId: "u1", propertyId: "p1" });
    expect(EventSchema.safeParse({ ...e, data: { userId: "" } }).success).toBe(false);
    expect(EventSchema.safeParse({ ...e, eventId: "not-a-uuid" }).success).toBe(false);
  });

  it("routes every event type to a topic and a partition key", () => {
    for (const type of EVENT_TYPES) expect(TOPIC_FOR_EVENT[type as keyof typeof TOPIC_FOR_EVENT]).toBeTruthy();
    const view = buildEvent("property.viewed", { userId: "u1", propertyId: "p1" });
    const up = buildEvent("property.removed", { propertyId: "p9" });
    expect(partitionKey(view)).toBe("u1");
    expect(partitionKey(up)).toBe("p9");
    expect(TOPIC_FOR_EVENT["inquiry.created"]).toBe(Topics.INQUIRIES);
  });

  it("every main topic has a DLQ topic spec", () => {
    const names = TOPIC_SPECS.map((t) => t.name);
    for (const t of Object.values(Topics)) expect(names).toContain(dlqTopic(t));
  });
});
