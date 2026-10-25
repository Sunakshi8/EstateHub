import { Types } from "mongoose";
import { events } from "../events/emitters";
import { checkDuplicateViaGrpc } from "../grpcClients/duplicateDetectorClient";
import { asyncHandler } from "../middleware/asyncHandler";
import { Property, type IPropertyLocation } from "../models/Property";
import { User } from "../models/User";
import { buildPropertyQuery } from "../utils/buildPropertyQuery";
import { findDuplicate } from "../utils/duplicateCheck";
import { idString } from "../utils/ids";

function parseLocation(value: unknown): IPropertyLocation {
  return typeof value === "string" ? JSON.parse(value) : (value as IPropertyLocation);
}

function parseAmenities(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value) return String(value).split(",").map((a) => a.trim()).filter(Boolean);
  return [];
}

// @route POST /api/properties  (agent, admin)
export const createProperty = asyncHandler(async (req, res) => {
  const body = req.body;
  const user = req.user!;

  if (!body.title || !body.description || !body.price || !body.propertyType || !body.location) {
    return res.status(400).json({ message: "Missing required property fields" });
  }

  const location = parseLocation(body.location);
  const amenities = parseAmenities(body.amenities);
  const images: string[] = Array.isArray(body.images) ? body.images : body.images ? [body.images] : [];

  // Duplicate detection is delegated to the standalone gRPC microservice
  // first; if it is unreachable, fall back to the in-process check so listing
  // creation never hard-fails because of it.
  const duplicateArgs = {
    address: location.address,
    city: location.city,
    price: Number(body.price),
    contactPhone: body.contactPhone,
  };
  const grpcResult = await checkDuplicateViaGrpc(duplicateArgs);
  const duplicateId = grpcResult.available ? grpcResult.duplicateId : await findDuplicate(duplicateArgs);

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
    contactPhone: body.contactPhone || user.phone || "",
    contactEmail: body.contactEmail || user.email,
    owner: user._id,
    moderationStatus: user.role === "admin" ? "approved" : "pending",
    duplicateOf: duplicateId ? new Types.ObjectId(duplicateId) : null,
    priceHistory: [{ price: Number(body.price), changedAt: new Date() }],
  });

  events.propertyUpserted(property, req.correlationId);

  return res.status(201).json({
    property,
    duplicateWarning: duplicateId
      ? "A similar listing already exists. This listing has been flagged for admin review."
      : null,
  });
});

// @route GET /api/properties  (public - approved only)
export const getProperties = asyncHandler(async (req, res) => {
  const { query, sortOption, pageNum, limitNum, skip } = buildPropertyQuery(req.query);

  const [properties, total] = await Promise.all([
    Property.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate("owner", "name email phone role"),
    Property.countDocuments(query),
  ]);

  // Logged-in searches feed the recommendation model (search intent signal).
  if (req.user) {
    const q = req.query;
    const filters = {
      ...(q.city ? { city: String(q.city) } : {}),
      ...(q.propertyType ? { propertyType: String(q.propertyType) } : {}),
      ...(q.furnishing ? { furnishing: String(q.furnishing) } : {}),
      ...(q.bedrooms && Number.isInteger(Number(q.bedrooms)) ? { bedrooms: Number(q.bedrooms) } : {}),
      ...(q.minPrice && Number(q.minPrice) ? { minPrice: Number(q.minPrice) } : {}),
      ...(q.maxPrice && Number(q.maxPrice) ? { maxPrice: Number(q.maxPrice) } : {}),
    };
    if (Object.keys(filters).length) {
      events.searchPerformed(idString(req.user._id), filters, req.correlationId);
    }
  }

  return res.json({
    properties,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
});

// @route GET /api/properties/mine  (agent - own listings, any moderation status)
export const getMyProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ owner: req.user!._id }).sort({ createdAt: -1 });
  return res.json({ properties });
});

// @route GET /api/properties/favorites  (buyer)
export const getFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!._id).populate({
    path: "favorites",
    populate: { path: "owner", select: "name email phone" },
  });
  return res.json({ properties: user?.favorites ?? [] });
});

// @route GET /api/properties/:id
export const getPropertyById = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id).populate("owner", "name email phone role");
  if (!property) return res.status(404).json({ message: "Property not found" });

  const ownerId = idString(property.owner);
  const isOwner = !!req.user && ownerId === idString(req.user._id);
  const isAdmin = !!req.user && req.user.role === "admin";
  if (property.moderationStatus !== "approved" && !isOwner && !isAdmin) {
    return res.status(403).json({ message: "This listing is not yet approved" });
  }

  // Atomic increment (the JS version did read-modify-write via save()).
  await Property.updateOne({ _id: property._id }, { $inc: { viewCount: 1 } });
  property.viewCount += 1;

  if (req.user && !isOwner) {
    events.propertyViewed(idString(req.user._id), idString(property._id), req.correlationId);
  }

  return res.json({ property });
});

// @route PUT /api/properties/:id  (owner or admin)
export const updateProperty = asyncHandler(async (req, res) => {
  const user = req.user!;
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  const isOwner = idString(property.owner) === idString(user._id);
  if (!isOwner && user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized to edit this listing" });
  }

  const body = req.body;
  const fields = [
    "title", "description", "propertyType", "bedrooms", "bathrooms", "area",
    "furnishing", "contactPhone", "contactEmail", "bookingStatus",
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) property.set(f, body[f]);
  }

  if (body.location) property.location = parseLocation(body.location);
  if (body.amenities) property.amenities = parseAmenities(body.amenities);
  if (body.images) property.images = Array.isArray(body.images) ? body.images : [body.images];
  if (body.price !== undefined && Number(body.price) !== property.price) {
    property.priceHistory.push({ price: Number(body.price), changedAt: new Date() });
    property.price = Number(body.price);
  }

  property.lastUpdatedAt = new Date();
  // Edits by non-admins go back to pending review
  if (user.role !== "admin") property.moderationStatus = "pending";

  await property.save();
  events.propertyUpserted(property, req.correlationId);
  return res.json({ property });
});

// @route DELETE /api/properties/:id  (owner or admin)
export const deleteProperty = asyncHandler(async (req, res) => {
  const user = req.user!;
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  const isOwner = idString(property.owner) === idString(user._id);
  if (!isOwner && user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized to delete this listing" });
  }

  await property.deleteOne();
  events.propertyRemoved(idString(property._id), req.correlationId);
  return res.json({ message: "Property deleted" });
});

// @route PUT /api/properties/:id/favorite  (any logged-in user)
export const toggleFavorite = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!._id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const propertyId = String(req.params.id);
  const idx = user.favorites.findIndex((f) => idString(f) === propertyId);
  let favorited: boolean;
  if (idx === -1) {
    user.favorites.push(new Types.ObjectId(propertyId));
    favorited = true;
  } else {
    user.favorites.splice(idx, 1);
    favorited = false;
  }
  await user.save();

  events.propertyFavorited(idString(user._id), propertyId, favorited, req.correlationId);
  return res.json({ favorited, favorites: user.favorites });
});
