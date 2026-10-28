import mongoose, { Schema } from "mongoose";
import { IUser } from "../interfaces/user.interface";

const UserSchema = new Schema<IUser>(
  {
    nameUser: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    // Kept for older documents; every account is active from registration now.
    status: { type: String, enum: ["pending", "active"], default: "active" },
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    proSince: { type: Date, default: null },
    proSource: { type: String, enum: ["payment", "admin", null], default: null },
    // Catat Cepat messages that reached the LLM in `aiUsageMonth` ("YYYY-MM", client local time).
    aiUsageMonth: { type: String, default: null },
    aiUsageCount: { type: Number, default: 0 },
    tokenValidAfter: { type: Date, default: null },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", UserSchema);
