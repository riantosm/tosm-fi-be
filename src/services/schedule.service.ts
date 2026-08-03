import mongoose from "mongoose";
import { ScheduleModel } from "../models/schedule.model";
import { ScheduleOccurrenceModel } from "../models/schedule-occurrence.model";
import { WalletModel } from "../models/wallet.model";
import { CategoryModel } from "../models/category.model";
import { createCore as createTransactionCore } from "./transaction.service";
import { addDaysUtc, getFirstDueDate, getNextDueDate, startOfUtcDay } from "../utils/scheduleDates";
import {
  ICreateScheduleInput,
  IPayOccurrenceInput,
  ISafeSchedule,
  ISafeScheduleOccurrence,
  IUpdateScheduleInput,
  ScheduleFrequency,
} from "../interfaces/schedule.interface";
import { ISafeTransaction } from "../interfaces/transaction.interface";

// Occurrences become visible (Bayar/Batal already active) this many days
// before their due date, per the product decision to allow paying early.
const VISIBILITY_HORIZON_DAYS = 2;

const toSafeSchedule = (schedule: any): ISafeSchedule => ({
  idSchedule: schedule._id.toString(),
  title: schedule.title,
  notes: schedule.notes,
  type: schedule.type,
  amount: schedule.amount,
  idWallet: schedule.idWallet,
  idCategory: schedule.idCategory,
  idSubCategory: schedule.idSubCategory,
  frequency: schedule.frequency,
  weekdays: schedule.weekdays,
  dayOfMonth: schedule.dayOfMonth,
  month: schedule.month,
  startDate: schedule.startDate.toISOString(),
  isActive: schedule.isActive,
});

const toSafeOccurrence = (occurrence: any): ISafeScheduleOccurrence => ({
  idOccurrence: occurrence._id.toString(),
  idSchedule: occurrence.idSchedule,
  dueDate: occurrence.dueDate.toISOString(),
  status: occurrence.status,
  type: occurrence.type,
  title: occurrence.title,
  amount: occurrence.amount,
  idWallet: occurrence.idWallet,
  idCategory: occurrence.idCategory,
  idSubCategory: occurrence.idSubCategory,
  idTransaction: occurrence.idTransaction,
});

async function assertOwnedWallet(idUser: string, idWallet: string): Promise<void> {
  const exists = await WalletModel.exists({ _id: idWallet, idUser });
  if (!exists) throw new Error("Wallet tidak ditemukan");
}

interface NormalizedScheduleInput {
  title: string;
  notes: string;
  type: "income" | "expense";
  amount: number;
  idWallet: string;
  idCategory: string;
  idSubCategory: string | null;
  frequency: ScheduleFrequency;
  weekdays: number[];
  dayOfMonth: number | null;
  month: number | null;
  startDate: Date;
}

// Validates ownership/shape and derives dayOfMonth/month from startDate so
// the frontend never has to compute or send them directly.
async function validateAndNormalize(
  idUser: string,
  input: ICreateScheduleInput,
): Promise<NormalizedScheduleInput> {
  if (!input.title?.trim()) throw new Error("title wajib diisi");
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("amount harus lebih besar dari 0");
  }
  if (!input.idWallet) throw new Error("idWallet wajib diisi");
  if (!input.idCategory) throw new Error("idCategory wajib diisi");
  if (!input.startDate) throw new Error("startDate wajib diisi");
  if (input.type !== "income" && input.type !== "expense") throw new Error("type tidak valid");

  await assertOwnedWallet(idUser, input.idWallet);
  const category = await CategoryModel.findOne({ _id: input.idCategory, idUser });
  if (!category) throw new Error("Kategori tidak ditemukan");
  if (category.type !== input.type) throw new Error("Tipe kategori tidak sesuai dengan tipe schedule");
  if (input.idSubCategory && !category.subCategories.id(input.idSubCategory)) {
    throw new Error("Subkategori tidak ditemukan");
  }

  const startDate = startOfUtcDay(new Date(input.startDate));
  if (Number.isNaN(startDate.getTime())) throw new Error("startDate tidak valid");

  let weekdays: number[] = [];
  let dayOfMonth: number | null = null;
  let month: number | null = null;

  switch (input.frequency) {
    case "daily":
      break;
    case "weekly": {
      weekdays = [...new Set(input.weekdays ?? [])].sort((a, b) => a - b);
      if (weekdays.length === 0 || weekdays.some((d) => d < 0 || d > 6)) {
        throw new Error("weekdays wajib diisi (0-6) untuk frequency mingguan");
      }
      break;
    }
    case "monthly":
      dayOfMonth = startDate.getUTCDate();
      break;
    case "yearly":
      dayOfMonth = startDate.getUTCDate();
      month = startDate.getUTCMonth() + 1;
      break;
    default:
      throw new Error("frequency tidak valid");
  }

  return {
    title: input.title.trim(),
    notes: input.notes?.trim() ?? "",
    type: input.type,
    amount: input.amount,
    idWallet: input.idWallet,
    idCategory: input.idCategory,
    idSubCategory: input.idSubCategory ?? null,
    frequency: input.frequency,
    weekdays,
    dayOfMonth,
    month,
    startDate,
  };
}

// Generates every occurrence due within [now, now + VISIBILITY_HORIZON_DAYS]
// for each of the user's active schedules that hasn't generated that far
// yet. Idempotent and safe under concurrent requests: a duplicate due date
// is caught by ScheduleOccurrence's unique {idSchedule,dueDate} index and
// silently ignored, since it just means another request already generated it.
async function generateDueOccurrences(idUser: string): Promise<void> {
  const horizon = addDaysUtc(startOfUtcDay(new Date()), VISIBILITY_HORIZON_DAYS);
  const schedules = await ScheduleModel.find({ idUser, isActive: true });

  for (const schedule of schedules) {
    const rule = {
      frequency: schedule.frequency,
      weekdays: schedule.weekdays,
      dayOfMonth: schedule.dayOfMonth,
      month: schedule.month,
    };

    let dueDate = schedule.lastGeneratedDueDate
      ? getNextDueDate(schedule.lastGeneratedDueDate, rule)
      : getFirstDueDate(schedule.startDate, rule);

    const toInsert: any[] = [];
    let newestGenerated: Date | null = null;
    while (dueDate.getTime() <= horizon.getTime()) {
      toInsert.push({
        idUser,
        idSchedule: schedule._id.toString(),
        dueDate,
        status: "pending",
        type: schedule.type,
        title: schedule.title,
        amount: schedule.amount,
        idWallet: schedule.idWallet,
        idCategory: schedule.idCategory,
        idSubCategory: schedule.idSubCategory,
      });
      newestGenerated = dueDate;
      dueDate = getNextDueDate(dueDate, rule);
    }

    if (toInsert.length === 0) continue;

    try {
      await ScheduleOccurrenceModel.insertMany(toInsert, { ordered: false });
    } catch (error: any) {
      const onlyDuplicates =
        error?.code === 11000 || error?.writeErrors?.every((e: any) => e.code === 11000);
      if (!onlyDuplicates) throw error;
    }

    await ScheduleModel.updateOne(
      { _id: schedule._id, idUser },
      { $set: { lastGeneratedDueDate: newestGenerated } },
    );
  }
}

export const ScheduleService = {
  async list(idUser: string): Promise<ISafeSchedule[]> {
    const schedules = await ScheduleModel.find({ idUser }).sort({ createdAt: -1 }).lean();
    return schedules.map(toSafeSchedule);
  },

  async create(idUser: string, input: ICreateScheduleInput): Promise<ISafeSchedule> {
    const normalized = await validateAndNormalize(idUser, input);
    const schedule = await ScheduleModel.create({ idUser, ...normalized, isActive: true, lastGeneratedDueDate: null });
    return toSafeSchedule(schedule);
  },

  async update(idUser: string, idSchedule: string, input: IUpdateScheduleInput): Promise<ISafeSchedule> {
    const existing = await ScheduleModel.findOne({ _id: idSchedule, idUser });
    if (!existing) throw new Error("Schedule tidak ditemukan");

    const normalized = await validateAndNormalize(idUser, input);

    // Only reset the generation cursor when a rule change actually affects
    // future due dates — an edit to just title/amount/wallet/category must
    // not regenerate (and thus duplicate-skip) already-planned occurrences.
    const recurrenceChanged =
      existing.frequency !== normalized.frequency ||
      existing.startDate.getTime() !== normalized.startDate.getTime() ||
      JSON.stringify(existing.weekdays) !== JSON.stringify(normalized.weekdays);

    existing.set(normalized);
    if (recurrenceChanged) existing.lastGeneratedDueDate = null;
    await existing.save();

    if (recurrenceChanged) {
      // Due dates no longer match the new rule; drop pending occurrences so
      // generateDueOccurrences rebuilds them fresh from the new startDate
      // instead of leaving stale ones (e.g. the old due date) alongside them.
      await ScheduleOccurrenceModel.deleteMany({ idUser, idSchedule, status: "pending" });
    } else {
      // Due dates are unchanged, but display fields (title/amount/wallet/
      // category) may have — keep already-generated pending occurrences in
      // sync instead of leaving them showing stale data until paid/cancelled.
      await ScheduleOccurrenceModel.updateMany(
        { idUser, idSchedule, status: "pending" },
        {
          $set: {
            type: normalized.type,
            title: normalized.title,
            amount: normalized.amount,
            idWallet: normalized.idWallet,
            idCategory: normalized.idCategory,
            idSubCategory: normalized.idSubCategory,
          },
        },
      );
    }

    return toSafeSchedule(existing);
  },

  async setActive(idUser: string, idSchedule: string, isActive: boolean): Promise<ISafeSchedule> {
    const updated = await ScheduleModel.findOneAndUpdate(
      { _id: idSchedule, idUser },
      { $set: { isActive } },
      { new: true },
    );
    if (!updated) throw new Error("Schedule tidak ditemukan");
    return toSafeSchedule(updated);
  },

  async remove(idUser: string, idSchedule: string): Promise<void> {
    const existing = await ScheduleModel.findOne({ _id: idSchedule, idUser });
    if (!existing) throw new Error("Schedule tidak ditemukan");

    await ScheduleModel.deleteOne({ _id: idSchedule, idUser });
    // Pending occurrences no longer make sense once their rule is gone; paid
    // occurrences (and their linked transactions) and cancelled history stay.
    await ScheduleOccurrenceModel.deleteMany({ idUser, idSchedule, status: "pending" });
  },

  async listPendingOccurrences(idUser: string): Promise<ISafeScheduleOccurrence[]> {
    await generateDueOccurrences(idUser);
    const occurrences = await ScheduleOccurrenceModel.find({ idUser, status: "pending" })
      .sort({ dueDate: 1 })
      .lean();
    return occurrences.map(toSafeOccurrence);
  },

  async pay(
    idUser: string,
    idOccurrence: string,
    overrides: IPayOccurrenceInput,
  ): Promise<{ transaction: ISafeTransaction; occurrence: ISafeScheduleOccurrence }> {
    const session = await mongoose.startSession();
    try {
      let result!: { transaction: ISafeTransaction; occurrence: ISafeScheduleOccurrence };
      await session.withTransaction(async () => {
        // Conditional update (not read-then-write) is the race guard: only
        // one concurrent "pay" can ever flip pending -> paid.
        const occurrence = await ScheduleOccurrenceModel.findOneAndUpdate(
          { _id: idOccurrence, idUser, status: "pending" },
          { $set: { status: "paid" } },
          { session },
        );
        if (!occurrence) throw new Error("Jadwal sudah diproses atau tidak ditemukan");

        const transaction = await createTransactionCore(
          idUser,
          {
            type: occurrence.type,
            idWallet: overrides.idWallet ?? occurrence.idWallet,
            idCategory: overrides.idCategory ?? occurrence.idCategory,
            idSubCategory:
              overrides.idSubCategory !== undefined ? overrides.idSubCategory : occurrence.idSubCategory,
            title: overrides.title ?? occurrence.title,
            notes: overrides.notes ?? "",
            amount: overrides.amount ?? occurrence.amount,
            date: overrides.date ?? new Date().toISOString(),
          },
          session,
        );

        const updated = await ScheduleOccurrenceModel.findOneAndUpdate(
          { _id: idOccurrence, idUser },
          { $set: { idTransaction: transaction.idTransaction, paidAt: new Date() } },
          { new: true, session },
        );

        result = { transaction, occurrence: toSafeOccurrence(updated) };
      });
      return result;
    } finally {
      await session.endSession();
    }
  },

  async cancel(idUser: string, idOccurrence: string): Promise<ISafeScheduleOccurrence> {
    const updated = await ScheduleOccurrenceModel.findOneAndUpdate(
      { _id: idOccurrence, idUser, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
      { new: true },
    );
    if (!updated) throw new Error("Jadwal sudah diproses atau tidak ditemukan");
    return toSafeOccurrence(updated);
  },
};
