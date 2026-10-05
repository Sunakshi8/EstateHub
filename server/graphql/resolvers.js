const Property = require("../models/Property");
const Review = require("../models/Review");
const buildPropertyQuery = require("../utils/buildPropertyQuery");

async function attachRatingStats(properties) {
  const ids = properties.map((p) => p._id);
  const stats = await Review.aggregate([
    { $match: { property: { $in: ids } } },
    { $group: { _id: "$property", avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]);
  const statsById = Object.fromEntries(stats.map((s) => [String(s._id), s]));

  return properties.map((p) => {
    const obj = p.toObject();
    const stat = statsById[String(p._id)];
    return {
      ...obj,
      id: obj._id,
      avgRating: stat ? Math.round(stat.avgRating * 10) / 10 : null,
      reviewCount: stat ? stat.reviewCount : 0,
    };
  });
}

const resolvers = {
  Query: {
    properties: async (_parent, { filter = {} }) => {
      const { query, sortOption, pageNum, limitNum, skip } = buildPropertyQuery(filter);

      const [docs, total] = await Promise.all([
        Property.find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limitNum)
          .populate("owner", "name email phone role"),
        Property.countDocuments(query),
      ]);

      const properties = await attachRatingStats(docs);

      return {
        properties,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
      };
    },

    property: async (_parent, { id }) => {
      const doc = await Property.findOne({ _id: id, moderationStatus: "approved" }).populate(
        "owner",
        "name email phone role"
      );
      if (!doc) return null;
      const [withStats] = await attachRatingStats([doc]);
      return withStats;
    },

    reviewsByProperty: async (_parent, { propertyId }) => {
      const reviews = await Review.find({ property: propertyId })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });
      return reviews.map((r) => ({ ...r.toObject(), id: r._id }));
    },
  },

  // Map Mongoose's _id to GraphQL's id on nested object types
  Owner: {
    id: (parent) => parent._id || parent.id,
  },
  ReviewUser: {
    id: (parent) => parent._id || parent.id,
  },
};

module.exports = resolvers;
