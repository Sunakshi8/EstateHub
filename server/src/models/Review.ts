import { Schema, Types, model } from "mongoose";

export interface IReview {
  property: Types.ObjectId;
  user: Types.ObjectId;
  rating: number;
  subRatings: {
    cleanliness?: number;
    maintenance?: number;
    safety?: number;
    waterSupply?: number;
    noise?: number;
    management?: number;
  };
  text: string;
  photos: string[];
  verified: boolean;
  helpfulVotes: number;
  votedBy: Types.ObjectId[];
  reported: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    votedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reported: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reviewSchema.index({ property: 1, user: 1 }, { unique: true });

export const Review = model<IReview>("Review", reviewSchema);
