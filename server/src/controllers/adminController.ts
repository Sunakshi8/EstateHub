import { Inquiry } from "../models/Inquiry";
import { Property } from "../models/Property";
import { Review } from "../models/Review";
import { User } from "../models/User";
import { events } from "../events/emitters";
import { asyncHandler } from "../middleware/asyncHandler";

// @route GET /api/admin/properties/pending
export const getPendingProperties = asyncHandler(async (_req, res) => {
  const properties = await Property.find({ moderationStatus: "pending" })
    .populate("owner", "name email phone")
    .populate("duplicateOf", "title")
    .sort({ createdAt: -1 });
  return res.json({ properties });
});

// @route PUT /api/admin/properties/:id/moderate  { status: "approved" | "rejected" }
export const moderateProperty = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
  }
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ message: "Property not found" });

  property.moderationStatus = status;
  await property.save();

  // Approval is what makes a listing recommendable (and rejection removes it).
  events.propertyUpserted(property, req.correlationId);
  return res.json({ property });
});

// @route GET /api/admin/users
export const getAllUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  return res.json({ users });
});

// @route GET /api/admin/reviews/reported
export const getReportedReviews = asyncHandler(async (_req, res) => {
  const reviews = await Review.find({ reported: true })
    .populate("user", "name email")
    .populate("property", "title");
  return res.json({ reviews });
});

// @route DELETE /api/admin/reviews/:id
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  await review.deleteOne();
  return res.json({ message: "Review removed" });
});

// @route GET /api/admin/stats
export const getStats = asyncHandler(async (_req, res) => {
  const [totalListings, pendingListings, totalUsers, totalInquiries, totalReviews] =
    await Promise.all([
      Property.countDocuments(),
      Property.countDocuments({ moderationStatus: "pending" }),
      User.countDocuments(),
      Inquiry.countDocuments(),
      Review.countDocuments(),
    ]);
  return res.json({ totalListings, pendingListings, totalUsers, totalInquiries, totalReviews });
});
