import mongoose from "mongoose";
import { UserModel } from "../models/user.model";

// Cached across invocations so a warm serverless container reuses the same
// connection instead of reconnecting to Atlas on every request — without
// this, every cold start (and Vercel spins up many, even for back-to-back
// requests) pays the full TLS/auth handshake inline with the request, which
// can be slow enough to time out before any response (CORS headers included)
// reaches the browser.
let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    const mongoUri = process.env.MONGO_URI as string;

    connectionPromise = mongoose
      .connect(mongoUri)
      .then(async (conn) => {
        console.log("✅ MongoDB Connected");

        // Keeps DB indexes in sync with the current schema — drops indexes for
        // fields that no longer exist (e.g. a renamed unique field) instead of
        // leaving them behind to reject future inserts with a stale dup-key error.
        await UserModel.syncIndexes();
        return conn;
      })
      .catch((error) => {
        // Let the next request try again from scratch instead of being stuck
        // behind a permanently-rejected cached promise.
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
};
