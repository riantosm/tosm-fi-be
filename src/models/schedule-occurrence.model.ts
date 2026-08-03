import mongoose, { Schema } from "mongoose";
import { IScheduleOccurrence } from "../interfaces/schedule.interface";

const ScheduleOccurrenceSchema = new Schema<IScheduleOccurrence>(
  {
    idUser: { type: String, required: true, index: true },
    idSchedule: { type: String, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["pending", "paid", "cancelled"], default: "pending" },
    type: { type: String, enum: ["income", "expense"], required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    idWallet: { type: String, required: true },
    idCategory: { type: String, required: true },
    idSubCategory: { type: String, default: null },
    idTransaction: { type: String, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevents double-generating the same due-date occurrence for a schedule
// when two requests race the lazy catch-up generator.
ScheduleOccurrenceSchema.index({ idSchedule: 1, dueDate: 1 }, { unique: true });
// Supports the pending-list fetch, sorted by due date, scoped per user.
ScheduleOccurrenceSchema.index({ idUser: 1, status: 1, dueDate: 1 });

export const ScheduleOccurrenceModel = mongoose.model<IScheduleOccurrence>(
  "ScheduleOccurrence",
  ScheduleOccurrenceSchema
);
