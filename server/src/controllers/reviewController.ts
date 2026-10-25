import { Inquiry } from "../models/Inquiry";
import { Property } from "../models/Property";
import { Review } from "../models/Review";
import { asyncHandler } from "../middleware/asyncHandler";

// @route POST /api/reviews  (any logged-in user)
export const createReview = asyncHandler(async (req, res) => {
  const { propertyId, rating, subRatings, text, photos } = req.body;
  if (!propertyId || !rating || !text) {
    return res.status(400).json({ message: "propertyId, rating, and text are required" });
  }

  const property = await Property.findById(propertyId);
  if (!property) return res.status(404).json({ message: "Property not found" });

  const user = req.user!;
  const alreadyReviewed = await Review.findOne({ property: propertyId, user: user._id });
  if (alreadyReviewed) {
    return res.status(400).json({ message: "You have already reviewed this property" });
  }

  // Verified badge: auto-tagged if reviewer previously sent an inquiry for this property
  const priorInquiry = await Inquiry.findOne({ property: propertyId, buyer: user._id });

  const review = await Review.create({
    property: propertyId,
    user: user._id,
    rating,
    subRatings: subRatings || {},
    text,
    photos: photos || [],
    verified: !!priorInquiry,
  });

  return res.status(201).json({ review });
});

// @route GET /api/reviews/property/:propertyId
export const getPropertyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ property: req.params.propertyId })
    .populate("user", "name avatar")
    .sort({ createdAt: -1 });

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return res.json({ reviews, avgRating: Math.round(avgRating * 10) / 10, count: reviews.length });
});

// @route PUT /api/reviews/:id/helpful
export const markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  const userId = req.user!._id;
  if (review.votedBy.some((id) => id.equals(userId))) {
    return res.status(400).json({ message: "You already marked this review helpful" });
  }

  review.helpfulVotes += 1;
  review.votedBy.push(userId);
  await review.save();
  return res.json({ review });
});

// @route PUT /api/reviews/:id/report
export const reportReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  review.reported = true;
  await review.save();
  return res.json({ message: "Review reported for admin moderation" });
});
