const Property = require("../models/Property");
const User = require("../models/User");
const Review = require("../models/Review");
const Inquiry = require("../models/Inquiry");

// @route GET /api/admin/properties/pending
const getPendingProperties = async (req, res) => {
  try {
    const properties = await Property.find({ moderationStatus: "pending" })
      .populate("owner", "name email phone")
      .populate("duplicateOf", "title")
      .sort({ createdAt: -1 });
    return res.json({ properties });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/admin/properties/:id/moderate  { status: "approved" | "rejected" }
const moderateProperty = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
    }
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    property.moderationStatus = status;
    await property.save();
    return res.json({ property });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/reviews/reported
const getReportedReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ reported: true })
      .populate("user", "name email")
      .populate("property", "title");
    return res.json({ reviews });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/admin/reviews/:id
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    await review.deleteOne();
    return res.json({ message: "Review removed" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [totalListings, pendingListings, totalUsers, totalInquiries, totalReviews] =
      await Promise.all([
        Property.countDocuments(),
        Property.countDocuments({ moderationStatus: "pending" }),
        User.countDocuments(),
        Inquiry.countDocuments(),
        Review.countDocuments(),
      ]);
    return res.json({ totalListings, pendingListings, totalUsers, totalInquiries, totalReviews });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getPendingProperties,
  moderateProperty,
  getAllUsers,
  getReportedReviews,
  deleteReview,
  getStats,
};
