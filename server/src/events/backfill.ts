import { Property } from "../models/Property";
import { publishPropertySnapshots } from "./emitters";

/**
 * Re-publishes `property.upserted` for every property so the
 * recommendation-service can (re)build its read model. Safe to run any time:
 * the consumer upserts by propertyId.
 */
export async function backfillPropertySnapshots(): Promise<number> {
  const docs = await Property.find({});
  await publishPropertySnapshots(docs);
  return docs.length;
}
