import { Schema, Types, model } from "mongoose";

export type InquiryType = "general" | "site-visit";
export type InquiryStatus = "new" | "responded" | "closed";

export interface IInquiryMessage {
  sender: Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IInquiry {
  property: Types.ObjectId;
  buyer: Types.ObjectId;
  agent: Types.ObjectId;
  type: InquiryType;
  preferredDate?: Date;
  status: InquiryStatus;
  contactRevealed: boolean;
  messages: IInquiryMessage[];
  lastInquiryAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IInquiryMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inquirySchema = new Schema<IInquiry>(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    agent: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["general", "site-visit"], default: "general" },
    preferredDate: { type: Date },
    status: { type: String, enum: ["new", "responded", "closed"], default: "new" },
    contactRevealed: { type: Boolean, default: false },
    messages: [messageSchema],
    lastInquiryAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

inquirySchema.index({ property: 1, buyer: 1 });

export const Inquiry = model<IInquiry>("Inquiry", inquirySchema);
