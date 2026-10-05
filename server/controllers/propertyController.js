const Property = require("../models/Property");
const User = require("../models/User");
const { findDuplicate } = require("../utils/duplicateCheck");
const buildPropertyQuery = require("../utils/buildPropertyQuery");
const { checkDuplicateViaGrpc } = require("../grpcClients/duplicateDetectorClient");

// @route POST /api/properties  (agent, admin)
const createProperty = async (req, res) => {
  try {
    const body = req.body;

    if (!body.title || !body.description || !body.price || !body.propertyType || !body.location) {
      return res.status(400).json({ message: "Missing required property fields" });
    }

    const location =
      typeof body.location === "string" ? JSON.parse(body.location) : body.location;
    const amenities = Array.isArray(body.amenities)
      ? body.amenities
      : body.amenities
      ? String(body.amenities).split(",").map((a) => a.trim()).filter(Boolean)
      : [];
    const images = Array.isArray(body.images) ? body.images : body.images ? [body.images] : [];

    // Duplicate detection is delegated to the standalone gRPC microservice
    // first; if that service is unreachable, fall back to the equivalent
    // in-process check so listing creation never hard-fails because of it.
    const duplicateCheckArgs = {
      address: location.address,
      city: location.city,
      price: Number(body.price),
      contactPhone: body.contactPhone,
    };
    const grpcResult = await checkDuplicateViaGrpc(duplicateCheckArgs);
    const duplicateId = grpcResult.available
      ? grpcResult.duplicateId
      : await findDuplicate(duplicateCheckArgs);

    const property = await Property.create({
      title: body.title,
      description: body.description,
      price: Number(body.price),
      propertyType: body.propertyType,
      bedrooms: Number(body.bedrooms) || 0,
      bathrooms: Number(body.bathrooms) || 0,
      area: Number(body.area) || 0,
      furnishing: body.furnishing || "unfurnished",
      amenities,
      images,
      location,
      contactPhone: body.contactPhone || req.user.phone || "",
      contactEmail: body.contactEmail || req.user.email,
      owner: req.user._id,
      moderationStatus: req.user.role === "admin" ? "approved" : "pending",
      duplicateOf: duplicateId || null,
      priceHistory: [{ price: Number(body.price) }],
    });

    return res.status(201).json({
      property,
      duplicateWarning: duplicateId
        ? "A similar listing already exists. This listing has been flagged for admin review."
        : null,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/properties  (public - approved only, unless owner/admin querystring mine=true)
const getProperties = async (req, res) => {
  try {
    const { query, sortOption, pageNum, limitNum, skip } = buildPropertyQuery(req.query);

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate("owner", "name email phone role"),
      Property.countDocuments(query),
    ]);

    return res.json({
      properties,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/properties/mine  (agent - own listings, any moderation status)
const getMyProperties = async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).sort({ createdAt: -1 });
    return res.json({ properties });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/properties/favorites  (buyer)
const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "favorites",
      populate: { path: "owner", select: "name email phone" },
    });
    return res.json({ properties: user.favorites });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/properties/:id
const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "owner",
      "name email phone role"
    );
    if (!property) return res.status(404).json({ message: "Property not found" });

    // Only owner/admin can view non-approved listings
    const isOwner = req.user && String(property.owner._id) === String(req.user._id);
    const isAdmin = req.user && req.user.role === "admin";
    if (property.moderationStatus !== "approved" && !isOwner && !isAdmin) {
      return res.status(403).json({ message: "This listing is not yet approved" });
    }

    property.viewCount += 1;
    await property.save();

    return res.json({ property });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/properties/:id  (owner or admin)
const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const isOwner = String(property.owner) === String(req.user._id);
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to edit this listing" });
    }

    const body = req.body;
    const fields = [
      "title",
      "description",
      "propertyType",
      "bedrooms",
      "bathrooms",
      "area",
      "furnishing",
      "contactPhone",
      "contactEmail",
      "bookingStatus",
    ];
    fields.forEach((f) => {
      if (body[f] !== undefined) property[f] = body[f];
    });

    if (body.location) {
      property.location =
        typeof body.location === "string" ? JSON.parse(body.location) : body.location;
    }
    if (body.amenities) {
      property.amenities = Array.isArray(body.amenities)
        ? body.amenities
        : String(body.amenities).split(",").map((a) => a.trim()).filter(Boolean);
    }
    if (body.images) {
      property.images = Array.isArray(body.images) ? body.images : [body.images];
    }
    if (body.price !== undefined && Number(body.price) !== property.price) {
      property.priceHistory.push({ price: Number(body.price) });
      property.price = Number(body.price);
    }

    property.lastUpdatedAt = new Date();
    // Edits by non-admins go back to pending review
    if (!isAdminUser(req.user)) property.moderationStatus = "pending";

    await property.save();
    return res.json({ property });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function isAdminUser(user) {
  return user.role === "admin";
}

// @route DELETE /api/properties/:id  (owner or admin)
const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const isOwner = String(property.owner) === String(req.user._id);
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this listing" });
    }

    await property.deleteOne();
    return res.json({ message: "Property deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/properties/:id/favorite  (buyer/any logged-in user)
const toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const propertyId = req.params.id;

    const idx = user.favorites.findIndex((f) => String(f) === String(propertyId));
    let favorited;
    if (idx === -1) {
      user.favorites.push(propertyId);
      favorited = true;
    } else {
      user.favorites.splice(idx, 1);
      favorited = false;
    }
    await user.save();
    return res.json({ favorited, favorites: user.favorites });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createProperty,
  getProperties,
  getMyProperties,
  getFavorites,
  getPropertyById,
  updateProperty,
  deleteProperty,
  toggleFavorite,
};
