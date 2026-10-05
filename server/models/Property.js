const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    propertyType: {
      type: String,
      enum: ["rent", "buy", "apartment", "house", "plot", "commercial"],
      required: true,
    },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    area: { type: Number, default: 0 }, // in sq ft
    furnishing: {
      type: String,
      enum: ["furnished", "semi-furnished", "unfurnished"],
      default: "unfurnished",
    },
    amenities: [{ type: String }],
    images: [{ type: String }],
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      locality: { type: String, default: "" },
      lat: { type: Number },
      lng: { type: Number },
    },
    contactPhone: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookingStatus: {
      type: String,
      enum: ["available", "booked", "sold", "rented"],
      default: "available",
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verifiedOwner: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null },
    priceHistory: [
      {
        price: Number,
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

propertySchema.index({ title: "text", "location.city": "text", "location.locality": "text" });

module.exports = mongoose.model("Property", propertySchema);
