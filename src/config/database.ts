import mongoose from "mongoose";
import { UserModel } from "../models/user.model";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI as string;

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected");

    // Keeps DB indexes in sync with the current schema — drops indexes for
    // fields that no longer exist (e.g. a renamed unique field) instead of
    // leaving them behind to reject future inserts with a stale dup-key error.
    await UserModel.syncIndexes();
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};
