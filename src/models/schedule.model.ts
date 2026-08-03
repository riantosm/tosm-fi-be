import mongoose, { Schema } from "mongoose";
import { ISchedule } from "../interfaces/schedule.interface";

const ScheduleSchema = new Schema<ISchedule>(
  {
    idUser: { type: String, required: true, index: true },
    title: { type: String, required: true },
    notes: { type: String, default: "" },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true },
    idWallet: { type: String, required: true },
    idCategory: { type: String, required: true },
    idSubCategory: { type: String, default: null },
    frequency: { type: String, enum: ["daily", "weekly", "monthly", "yearly"], required: true },
    weekdays: { type: [Number], default: [] },
    dayOfMonth: { type: Number, default: null },
    month: { type: Number, default: null },
    startDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    lastGeneratedDueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// Supports the catch-up generation scan (active schedules only) per user.
ScheduleSchema.index({ idUser: 1, isActive: 1 });

export const ScheduleModel = mongoose.model<ISchedule>("Schedule", ScheduleSchema);
