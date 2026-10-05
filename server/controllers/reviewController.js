const Review = require("../models/Review");
const Inquiry = require("../models/Inquiry");
const Property = require("../models/Property");

// @route POST /api/reviews  (any logged-in user)
const createReview = async (req, res) => {
  try {
    const { propertyId, rating, subRatings, text, photos } = req.body;
    if (!propertyId || !rating || !text) {
      return res.status(400).json({ message: "propertyId, rating, and text are required" });
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const alreadyReviewed = await Review.findOne({ property: propertyId, user: req.user._id });
    if (alreadyReviewed) {
      return res.status(400).json({ message: "You have already reviewed this property" });
    }

    // Verified badge: auto-tagged if reviewer previously sent an inquiry for this property
    const priorInquiry = await Inquiry.findOne({ property: propertyId, buyer: req.user._id });

    const review = await Review.create({
      property: propertyId,
      user: req.user._id,
      rating,
      subRatings: subRatings || {},
      text,
      photos: photos || [],
      verified: !!priorInquiry,
    });

    return res.status(201).json({ review });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/reviews/property/:propertyId
const getPropertyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ property: req.params.propertyId })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });

    const avgRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    return res.json({ reviews, avgRating: Math.round(avgRating * 10) / 10, count: reviews.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/reviews/:id/helpful
const markHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const already = review.votedBy.some((id) => String(id) === String(req.user._id));
    if (already) {
      return res.status(400).json({ message: "You already marked this review helpful" });
    }

    review.helpfulVotes += 1;
    review.votedBy.push(req.user._id);
    await review.save();
    return res.json({ review });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/reviews/:id/report
const reportReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.reported = true;
    await review.save();
    return res.json({ message: "Review reported for admin moderation" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { createReview, getPropertyReviews, markHelpful, reportReview };
