import { Schema, Types, model } from "mongoose";

export type PropertyType = "rent" | "buy" | "apartment" | "house" | "plot" | "commercial";
export type Furnishing = "furnished" | "semi-furnished" | "unfurnished";
export type BookingStatus = "available" | "booked" | "sold" | "rented";
export type ModerationStatus = "pending" | "approved" | "rejected";

export interface IPropertyLocation {
  address: string;
  city: string;
  locality: string;
  lat?: number;
  lng?: number;
}

export interface IProperty {
  title: string;
  description: string;
  price: number;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  area: number;
  furnishing: Furnishing;
  amenities: string[];
  images: string[];
  location: IPropertyLocation;
  contactPhone: string;
  contactEmail: string;
  owner: Types.ObjectId;
  bookingStatus: BookingStatus;
  moderationStatus: ModerationStatus;
  verifiedOwner: boolean;
  viewCount: number;
  lastUpdatedAt: Date;
  duplicateOf: Types.ObjectId | null;
  priceHistory: { price: number; changedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const propertySchema = new Schema<IProperty>(
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
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Property", default: null },
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
propertySchema.index({ moderationStatus: 1, createdAt: -1 });

export const Property = model<IProperty>("Property", propertySchema);
