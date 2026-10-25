// Domain-level helpers so controllers say *what happened*, not how it is
// serialized onto Kafka.
import type { HydratedDocument } from "mongoose";
import type { IProperty } from "../models/Property";
import { idString } from "../utils/ids";
import { buildEvent, emit, publishEvent } from "./producer";
import type { EventData } from "./shared/schemas";

export function toPropertyUpsertedData(p: HydratedDocument<IProperty>): EventData<"property.upserted"> {
  return {
    propertyId: idString(p._id),
    ownerId: idString(p.owner),
    moderationStatus: p.moderationStatus,
    bookingStatus: p.bookingStatus,
    price: p.price,
    city: p.location.city,
    locality: p.location.locality ?? "",
    propertyType: p.propertyType,
    bedrooms: p.bedrooms ?? 0,
    bathrooms: p.bathrooms ?? 0,
    area: p.area ?? 0,
    furnishing: p.furnishing,
    amenities: p.amenities ?? [],
  };
}

export const events = {
  propertyUpserted: (p: HydratedDocument<IProperty>, cid?: string) =>
    emit("property.upserted", toPropertyUpsertedData(p), cid),

  propertyRemoved: (propertyId: string, cid?: string) =>
    emit("property.removed", { propertyId }, cid),

  propertyViewed: (userId: string, propertyId: string, cid?: string) =>
    emit("property.viewed", { userId, propertyId }, cid),

  propertyFavorited: (userId: string, propertyId: string, favorited: boolean, cid?: string) =>
    emit(favorited ? "property.favorited" : "property.unfavorited", { userId, propertyId }, cid),

  searchPerformed: (userId: string, filters: EventData<"search.performed">["filters"], cid?: string) =>
    emit("search.performed", { userId, filters }, cid),

  inquiry: (
    type: "inquiry.created" | "inquiry.reopened",
    data: EventData<"inquiry.created">,
    cid?: string
  ) => emit(type, data, cid),
};

/** Awaitable bulk publish used by seed/backfill scripts. */
export async function publishPropertySnapshots(
  docs: HydratedDocument<IProperty>[]
): Promise<void> {
  for (const doc of docs) {
    await publishEvent(buildEvent("property.upserted", toPropertyUpsertedData(doc)));
  }
}
