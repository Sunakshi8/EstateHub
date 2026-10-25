import bcrypt from "bcryptjs";
import { Model, Schema, Types, model } from "mongoose";

export type Role = "buyer" | "agent" | "admin";

export interface IUser {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  avatar: string;
  favorites: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  role: Role;
  avatar: string;
  favorites: Types.ObjectId[];
  createdAt: Date;
}

export interface IUserMethods {
  matchPassword(entered: string): Promise<boolean>;
  toSafeObject(): SafeUser;
}

type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    role: { type: String, enum: ["buyer", "agent", "admin"], default: "buyer" },
    avatar: { type: String, default: "" },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Property" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.method("matchPassword", async function (entered: string) {
  return bcrypt.compare(entered, this.password);
});

userSchema.method("toSafeObject", function (): SafeUser {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    avatar: this.avatar,
    favorites: this.favorites,
    createdAt: this.createdAt,
  };
});

export const User = model<IUser, UserModel>("User", userSchema);
