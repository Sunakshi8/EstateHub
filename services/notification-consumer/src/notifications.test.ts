import { describe, expect, it, vi } from "vitest";
import { SeenEvents, notify } from "./notifications";
import type { EstateEvent } from "./shared/schemas";

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const inquiry = (eventId: string): EstateEvent => ({
  eventId, type: "inquiry.created", version: 1, occurredAt: new Date().toISOString(), producer: "t",
  data: { inquiryId: "i", propertyId: "p", buyerId: "b", agentId: "a", inquiryType: "general" },
});

describe("notify", () => {
  it("notifies once per event even if Kafka redelivers it", () => {
    const seen = new SeenEvents();
    const e = inquiry("11111111-1111-4111-8111-111111111111");
    notify(e, seen, logger); notify(e, seen, logger); notify(e, seen, logger);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("ignores events that are not inquiries", () => {
    logger.info.mockClear();
    notify({ ...inquiry("22222222-2222-4222-8222-222222222222"), type: "property.removed", data: { propertyId: "p" } } as EstateEvent, new SeenEvents(), logger);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("SeenEvents is bounded", () => {
    const s = new SeenEvents(2);
    s.add("a"); s.add("b"); s.add("c");
    expect(s.add("a")).toBe(true); // evicted, so treated as new again
  });
});
