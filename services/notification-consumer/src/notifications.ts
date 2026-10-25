import type { EstateEvent } from "./shared/schemas";
import type { Logger } from "./shared/logger";

/**
 * Bounded set of already-handled event ids. Kafka is at-least-once, so the
 * same inquiry event can be delivered twice (rebalance, retry after a crash);
 * without this an agent could get duplicate notifications.
 */
export class SeenEvents {
  private readonly ids = new Set<string>();
  constructor(private readonly capacity = 10_000) {}

  /** Returns true if the id is new (and records it), false if it was already seen. */
  add(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.capacity) {
      const oldest = this.ids.values().next().value as string;
      this.ids.delete(oldest);
    }
    return true;
  }
}

/**
 * Simulates whatever a real notification service would do with an inquiry
 * event — send an email, push a mobile notification, etc. Kept as a log line:
 * the point here is the event-driven wiring, not standing up an email provider.
 */
export function notify(event: EstateEvent, seen: SeenEvents, logger: Logger): void {
  if (event.type !== "inquiry.created" && event.type !== "inquiry.reopened") return; // not ours
  if (!seen.add(event.eventId)) {
    logger.debug({ eventId: event.eventId }, "duplicate event ignored");
    return;
  }

  const { inquiryId, propertyId, buyerId, agentId, inquiryType } = event.data;
  const base = { eventId: event.eventId, correlationId: event.correlationId, inquiryId, propertyId, agentId, buyerId };

  if (event.type === "inquiry.created") {
    logger.info(
      { ...base, inquiryType },
      `[notify] New ${inquiryType} inquiry on property ${propertyId} — would notify agent ${agentId} that buyer ${buyerId} reached out`
    );
  } else {
    logger.info(
      base,
      `[notify] Inquiry ${inquiryId} reopened — would notify agent ${agentId} of a new message from buyer ${buyerId}`
    );
  }
}
