/**
 * Builds the Mongo query, sort option, and pagination values for property
 * search/filtering. Shared by the REST /api/properties endpoint and the
 * GraphQL `properties` query so both stay in sync and never drift apart.
 */
function buildPropertyQuery(filters = {}) {
  const {
    keyword,
    city,
    locality,
    minPrice,
    maxPrice,
    propertyType,
    bedrooms,
    bathrooms,
    furnishing,
    amenities,
    bookingStatus,
    sort,
    page = 1,
    limit = 12,
  } = filters;

  const query = { moderationStatus: "approved" };

  if (keyword) {
    query.$or = [
      { title: new RegExp(keyword, "i") },
      { "location.city": new RegExp(keyword, "i") },
      { "location.locality": new RegExp(keyword, "i") },
      { description: new RegExp(keyword, "i") },
    ];
  }
  if (city) query["location.city"] = new RegExp(`^${city}$`, "i");
  if (locality) query["location.locality"] = new RegExp(locality, "i");
  if (propertyType) query.propertyType = propertyType;
  if (furnishing) query.furnishing = furnishing;
  if (bookingStatus) query.bookingStatus = bookingStatus;
  if (bedrooms) query.bedrooms = { $gte: Number(bedrooms) };
  if (bathrooms) query.bathrooms = { $gte: Number(bathrooms) };
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }
  if (amenities) {
    const list = Array.isArray(amenities)
      ? amenities
      : String(amenities).split(",").map((a) => a.trim()).filter(Boolean);
    if (list.length) query.amenities = { $all: list };
  }

  let sortOption = { createdAt: -1 };
  if (sort === "price_asc") sortOption = { price: 1 };
  if (sort === "price_desc") sortOption = { price: -1 };
  if (sort === "latest") sortOption = { createdAt: -1 };

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
  const skip = (pageNum - 1) * limitNum;

  return { query, sortOption, pageNum, limitNum, skip };
}

module.exports = buildPropertyQuery;
