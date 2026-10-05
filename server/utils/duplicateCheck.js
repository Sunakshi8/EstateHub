const Property = require("../models/Property");

/**
 * Flags likely-duplicate listings without ML:
 * same city + same address (case-insensitive) + price within ±5%
 * + same contact phone as an existing approved/pending listing.
 */
async function findDuplicate({ address, city, price, contactPhone }, excludeId = null) {
  if (!address || !city) return null;

  const priceMin = price * 0.95;
  const priceMax = price * 1.05;

  const query = {
    "location.address": new RegExp(`^${escapeRegex(address.trim())}$`, "i"),
    "location.city": new RegExp(`^${escapeRegex(city.trim())}$`, "i"),
    price: { $gte: priceMin, $lte: priceMax },
  };

  if (contactPhone) {
    query.contactPhone = contactPhone;
  }

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const match = await Property.findOne(query);
  return match ? match._id : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { findDuplicate };
