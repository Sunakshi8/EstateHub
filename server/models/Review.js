const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    subRatings: {
      cleanliness: { type: Number, min: 1, max: 5 },
      maintenance: { type: Number, min: 1, max: 5 },
      safety: { type: Number, min: 1, max: 5 },
      waterSupply: { type: Number, min: 1, max: 5 },
      noise: { type: Number, min: 1, max: 5 },
      management: { type: Number, min: 1, max: 5 },
    },
    text: { type: String, required: true },
    photos: [{ type: String }],
    verified: { type: Boolean, default: false },
    helpfulVotes: { type: Number, default: 0 },
    votedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reported: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
