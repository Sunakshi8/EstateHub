import { Types } from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler";
import { Property } from "../models/Property";
import { fetchPreferences, fetchRecommendations } from "../services/recommendationClient";
import { idString } from "../utils/ids";

// @route GET /api/recommendations?limit=8   (any logged-in user)
//
// Pipeline: Kafka -> recommendation-service -> PostgreSQL -> preference score.
// This endpoint asks the recommendation-service for ranked property ids +
// scores, then hydrates the full documents from MongoDB (source of truth).
// If the service is down we degrade to "latest approved listings".
export const getRecommendations = asyncHandler(async (req, res) => {
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
  const userId = idString(req.user!._id);

  const reco = await fetchRecommendations(userId, limit);

  if (reco && reco.items.length) {
    const ids = reco.items.map((i) => i.propertyId).filter((id) => Types.ObjectId.isValid(id));
    const docs = await Property.find({ _id: { $in: ids }, moderationStatus: "approved" }).populate(
      "owner",
      "name email phone role"
    );
    const byId = new Map(docs.map((d) => [idString(d._id), d]));

    const recommendations = reco.items.flatMap((item) => {
      const doc = byId.get(item.propertyId);
      return doc
        ? [{ ...doc.toObject(), recommendation: { score: item.score, reasons: item.reasons } }]
        : [];
    });

    if (recommendations.length) {
      return res.json({ source: reco.source, recommendations });
    }
  }

  const latest = await Property.find({ moderationStatus: "approved", owner: { $ne: req.user!._id } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("owner", "name email phone role");

  return res.json({
    source: "fallback",
    recommendations: latest.map((d) => ({ ...d.toObject(), recommendation: { score: null, reasons: [] } })),
  });
});

// @route GET /api/recommendations/preferences   (any logged-in user)
// The user's current (time-decayed) preference scores, highest first.
export const getMyPreferences = asyncHandler(async (req, res) => {
  const result = await fetchPreferences(idString(req.user!._id));
  return res.json({ preferences: result?.preferences ?? [], available: !!result });
});
