import type { EstateEvent } from "../shared/schemas";
import type { MessageContext } from "../shared/consumerRunner";
import { withTx } from "../db/pool";
import {
  applyPendingInteractions, bumpPreferences, getPropertyFeatures, insertInteraction,
  markInteractionApplied, markProcessed, removeProperty, upsertPropertyFeatures,
} from "../db/repo";
import { extractFeatures, featuresFromSearch } from "../scoring/features";
import { INTERACTION_WEIGHTS } from "../scoring/weights";
import { config } from "../config";
import { logger } from "../logger";

const CONSUMER = config.CONSUMER_GROUP;
const HALF_LIFE = config.HALF_LIFE_DAYS;

/** The user-property interactions we learn from, with their weight. */
function interactionOf(e: EstateEvent): { userId: string; propertyId: string; kind: string; weight: number } | null {
  switch (e.type) {
    case "property.viewed":
      return { ...e.data, kind: "viewed", weight: INTERACTION_WEIGHTS.viewed };
    case "property.favorited":
      return { ...e.data, kind: "favorited", weight: INTERACTION_WEIGHTS.favorited };
    case "property.unfavorited":
      return { ...e.data, kind: "unfavorited", weight: INTERACTION_WEIGHTS.unfavorited };
    case "inquiry.created":
      return {
        userId: e.data.buyerId, propertyId: e.data.propertyId, kind: "inquiry",
        weight: e.data.inquiryType === "site-visit" ? INTERACTION_WEIGHTS.siteVisitInquiry : INTERACTION_WEIGHTS.inquiryCreated,
      };
    case "inquiry.reopened":
      return { userId: e.data.buyerId, propertyId: e.data.propertyId, kind: "inquiry_reopened", weight: INTERACTION_WEIGHTS.inquiryReopened };
    default:
      return null;
  }
}

/**
 * Event handler for the recommendation-service. Every branch runs in ONE
 * Postgres transaction that starts with the idempotency check, so a redelivered
 * event is a no-op and a crash mid-way leaves no half-applied state.
 */
export async function handleEvent(event: EstateEvent, ctx: MessageContext): Promise<void> {
  const at = new Date(event.occurredAt);

  await withTx(async (tx) => {
    if (!(await markProcessed(tx, CONSUMER, event.eventId))) {
      logger.debug({ eventId: event.eventId, type: event.type }, "duplicate event skipped");
      return;
    }

    switch (event.type) {
      case "property.upserted": {
        const features = await upsertPropertyFeatures(tx, event.data, at);
        const applied = await applyPendingInteractions(tx, event.data.propertyId, features, HALF_LIFE);
        if (applied) logger.info({ propertyId: event.data.propertyId, applied }, "applied buffered interactions");
        return;
      }
      case "property.removed":
        await removeProperty(tx, event.data.propertyId);
        return;

      case "search.performed": {
        const kv = featuresFromSearch(event.data.filters);
        await bumpPreferences(tx, event.data.userId, kv, INTERACTION_WEIGHTS.search, at, HALF_LIFE);
        return;
      }

      default: {
        const i = interactionOf(event);
        if (!i) return;
        await insertInteraction(tx, { eventId: event.eventId, ...i, occurredAt: at });
        const features = await getPropertyFeatures(tx, i.propertyId);
        if (features) {
          await bumpPreferences(tx, i.userId, extractFeatures(features), i.weight, at, HALF_LIFE);
          await markInteractionApplied(tx, event.eventId);
        } // else: stays `applied = false` until the property snapshot arrives
        logger.debug({ eventId: event.eventId, kind: i.kind, partition: ctx.partition, offset: ctx.offset }, "interaction recorded");
      }
    }
  });
}
