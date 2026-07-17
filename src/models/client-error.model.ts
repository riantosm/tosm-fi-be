import mongoose, { Schema } from "mongoose";
import { IClientError } from "../interfaces/client-error.interface";

const ClientErrorSchema = new Schema<IClientError>(
  {
    idUser: { type: String, default: null, index: true },
    source: { type: String, required: true },
    message: { type: String, required: true },
    stack: { type: String },
    path: { type: String },
    userAgent: { type: String },
    extra: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Newest-first is the only order the admin error-log list ever reads in.
ClientErrorSchema.index({ createdAt: -1 });

export const ClientErrorModel = mongoose.model<IClientError>("ClientError", ClientErrorSchema);
