import mongoose from "mongoose";
import { TransactionModel } from "../models/transaction.model";
import { WalletModel } from "../models/wallet.model";
import { CategoryModel } from "../models/category.model";
import {
  ICreateTransactionInput,
  ISafeTransaction,
  ITransactionCategoryBreakdownItem,
  ITransactionListQuery,
  ITransactionListResult,
  ITransactionSubCategoryBreakdownItem,
  ITransactionSummary,
  IUpdateTransactionInput,
  TransactionType,
} from "../interfaces/transaction.interface";

const toSafeTransaction = (transaction: any): ISafeTransaction => ({
  idTransaction: transaction._id.toString(),
  type: transaction.type,
  idWallet: transaction.idWallet,
  idCategory: transaction.idCategory,
  idSubCategory: transaction.idSubCategory,
  idWalletFrom: transaction.idWalletFrom,
  idWalletTo: transaction.idWalletTo,
  title: transaction.title,
  notes: transaction.notes,
  amount: transaction.amount,
  date: transaction.date.toISOString(),
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  dateDesc: { date: -1 },
  dateAsc: { date: 1 },
  amountDesc: { amount: -1 },
  amountAsc: { amount: 1 },
};

// Combines the "month" shorthand with explicit dateFrom/dateTo into one
// intersected [start, end) range instead of two competing Mongo filters.
function buildDateFilter(query: ITransactionListQuery): { $gte: Date; $lt: Date } | null {
  let start = -Infinity;
  let end = Infinity;

  if (query.month) {
    const [year, month] = query.month.split("-").map(Number);
    start = Math.max(start, Date.UTC(year, month - 1, 1));
    end = Math.min(end, Date.UTC(year, month, 1));
  }
  if (query.dateFrom) {
    start = Math.max(start, new Date(`${query.dateFrom}T00:00:00.000Z`).getTime());
  }
  if (query.dateTo) {
    end = Math.min(end, new Date(`${query.dateTo}T23:59:59.999Z`).getTime() + 1);
  }

  if (start === -Infinity && end === Infinity) return null;
  return {
    $gte: new Date(start === -Infinity ? 0 : start),
    $lt: new Date(end === Infinity ? 8640000000000000 : end),
  };
}

function buildFilter(idUser: string, query: ITransactionListQuery): Record<string, any> {
  const filter: Record<string, any> = { idUser };
  const andConditions: Record<string, any>[] = [];

  const dateFilter = buildDateFilter(query);
  if (dateFilter) filter.date = dateFilter;

  if (query.idWallet) {
    andConditions.push({
      $or: [
        { idWallet: query.idWallet },
        { idWalletFrom: query.idWallet },
        { idWalletTo: query.idWallet },
      ],
    });
  }
  if (query.idCategory) filter.idCategory = query.idCategory;
  if (query.idSubCategory) filter.idSubCategory = query.idSubCategory;

  if (query.search?.trim()) {
    const pattern = new RegExp(escapeRegExp(query.search.trim()), "i");
    andConditions.push({ $or: [{ title: pattern }, { notes: pattern }] });
  }

  if (andConditions.length > 0) filter.$and = andConditions;
  return filter;
}

// Aggregated over the same `filter` `getList` uses for the transaction find
// (i.e. every applied query param except page/limit) so summary totals
// always reflect the whole matching set, not just the current page.
async function computeSummary(
  idUser: string,
  filter: Record<string, any>,
): Promise<ITransactionSummary> {
  const [totals, grouped] = await Promise.all([
    TransactionModel.aggregate([
      { $match: filter },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
    TransactionModel.aggregate([
      { $match: { ...filter, type: "expense", idCategory: { $ne: null } } },
      {
        $group: {
          _id: { idCategory: "$idCategory", idSubCategory: "$idSubCategory" },
          amount: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const income = totals.find((t) => t._id === "income")?.total ?? 0;
  const expense = totals.find((t) => t._id === "expense")?.total ?? 0;

  const categoryIds = [...new Set(grouped.map((g) => g._id.idCategory as string))];
  const categories = categoryIds.length
    ? await CategoryModel.find({ _id: { $in: categoryIds }, idUser })
    : [];
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));

  const byCategory = new Map<string, { amount: number; transactionCount: number; subs: typeof grouped }>();
  for (const g of grouped) {
    const idCategory = g._id.idCategory as string;
    const entry = byCategory.get(idCategory) ?? { amount: 0, transactionCount: 0, subs: [] };
    entry.amount += g.amount;
    entry.transactionCount += g.transactionCount;
    entry.subs.push(g);
    byCategory.set(idCategory, entry);
  }

  const categoryBreakdown: ITransactionCategoryBreakdownItem[] = [...byCategory.entries()]
    .map(([idCategory, entry]) => {
      const category = categoryMap.get(idCategory);
      const subCategoryBreakdown: ITransactionSubCategoryBreakdownItem[] = entry.subs
        .map((s) => {
          const idSubCategory = (s._id.idSubCategory as string | null) ?? null;
          const sub = idSubCategory ? category?.subCategories.id(idSubCategory) : null;
          return {
            idSubCategory,
            nameSubCategory: sub?.nameSubCategory ?? null,
            icon: sub?.icon ?? null,
            amount: s.amount,
            transactionCount: s.transactionCount,
            percentage: entry.amount > 0 ? (s.amount / entry.amount) * 100 : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      return {
        idCategory,
        nameCategory: category?.nameCategory ?? "-",
        color: category?.color ?? "#71717a",
        icon: category?.icon ?? "",
        amount: entry.amount,
        transactionCount: entry.transactionCount,
        percentage: expense > 0 ? (entry.amount / expense) * 100 : 0,
        subCategoryBreakdown,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { income, expense, net: income - expense, categoryBreakdown };
}

async function assertOwnedWallet(idUser: string, idWallet: string): Promise<void> {
  const exists = await WalletModel.exists({ _id: idWallet, idUser });
  if (!exists) throw new Error("Wallet tidak ditemukan");
}

interface NormalizedInput {
  type: TransactionType;
  title: string;
  notes: string;
  amount: number;
  date: Date;
  idWallet: string | null;
  idCategory: string | null;
  idSubCategory: string | null;
  idWalletFrom: string | null;
  idWalletTo: string | null;
}

async function validatePayload(idUser: string, input: ICreateTransactionInput): Promise<void> {
  if (!input.title?.trim()) throw new Error("title wajib diisi");
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount)) {
    throw new Error("amount wajib berupa angka");
  }
  if (!input.date) throw new Error("date wajib diisi");

  switch (input.type) {
    case "income":
    case "expense": {
      if (!input.idWallet) throw new Error("idWallet wajib diisi");
      if (!input.idCategory) throw new Error("idCategory wajib diisi");
      if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
      await assertOwnedWallet(idUser, input.idWallet);
      const category = await CategoryModel.findOne({ _id: input.idCategory, idUser });
      if (!category) throw new Error("Kategori tidak ditemukan");
      if (category.type !== input.type) {
        throw new Error("Tipe kategori tidak sesuai dengan tipe transaksi");
      }
      if (input.idSubCategory && !category.subCategories.id(input.idSubCategory)) {
        throw new Error("Subkategori tidak ditemukan");
      }
      break;
    }
    case "transfer": {
      if (!input.idWalletFrom || !input.idWalletTo) {
        throw new Error("idWalletFrom dan idWalletTo wajib diisi");
      }
      if (input.idWalletFrom === input.idWalletTo) {
        throw new Error("idWalletFrom dan idWalletTo tidak boleh sama");
      }
      if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
      await assertOwnedWallet(idUser, input.idWalletFrom);
      await assertOwnedWallet(idUser, input.idWalletTo);
      break;
    }
    case "correction": {
      if (!input.idWallet) throw new Error("idWallet wajib diisi");
      if (input.amount === 0) throw new Error("amount tidak boleh 0");
      await assertOwnedWallet(idUser, input.idWallet);
      break;
    }
    default:
      throw new Error("type tidak valid");
  }
}

// Strips fields that don't apply to the given type (e.g. a transfer never
// carries idCategory) so a type change on edit can't leave stale ids behind.
function normalizeInput(input: ICreateTransactionInput): NormalizedInput {
  const base = {
    type: input.type,
    title: input.title.trim(),
    notes: input.notes?.trim() ?? "",
    amount: input.amount,
    date: new Date(input.date),
  };

  switch (input.type) {
    case "income":
    case "expense":
      return {
        ...base,
        idWallet: input.idWallet ?? null,
        idCategory: input.idCategory ?? null,
        idSubCategory: input.idSubCategory ?? null,
        idWalletFrom: null,
        idWalletTo: null,
      };
    case "transfer":
      return {
        ...base,
        idWallet: null,
        idCategory: null,
        idSubCategory: null,
        idWalletFrom: input.idWalletFrom ?? null,
        idWalletTo: input.idWalletTo ?? null,
      };
    case "correction":
    default:
      return {
        ...base,
        idWallet: input.idWallet ?? null,
        idCategory: null,
        idSubCategory: null,
        idWalletFrom: null,
        idWalletTo: null,
      };
  }
}

interface WalletDelta {
  idWallet: string;
  amountDelta: number;
}

type WalletEffectSource = Pick<
  NormalizedInput,
  "type" | "amount" | "idWallet" | "idWalletFrom" | "idWalletTo"
>;

// Mirrors the frontend's (former) use-transactions.ts delta math exactly —
// the backend is now the sole owner of this logic.
function getWalletDeltas(entry: WalletEffectSource): WalletDelta[] {
  switch (entry.type) {
    case "income":
      return entry.idWallet ? [{ idWallet: entry.idWallet, amountDelta: entry.amount }] : [];
    case "expense":
      return entry.idWallet ? [{ idWallet: entry.idWallet, amountDelta: -entry.amount }] : [];
    case "correction":
      return entry.idWallet ? [{ idWallet: entry.idWallet, amountDelta: entry.amount }] : [];
    case "transfer": {
      const deltas: WalletDelta[] = [];
      if (entry.idWalletFrom) deltas.push({ idWallet: entry.idWalletFrom, amountDelta: -entry.amount });
      if (entry.idWalletTo) deltas.push({ idWallet: entry.idWalletTo, amountDelta: entry.amount });
      return deltas;
    }
    default:
      return [];
  }
}

function accumulateWalletDeltas(
  revert: WalletDelta[],
  apply: WalletDelta[],
): Map<string, { balanceDelta: number; countDelta: number }> {
  const map = new Map<string, { balanceDelta: number; countDelta: number }>();
  for (const { idWallet, amountDelta } of revert) {
    const entry = map.get(idWallet) ?? { balanceDelta: 0, countDelta: 0 };
    entry.balanceDelta -= amountDelta;
    entry.countDelta -= 1;
    map.set(idWallet, entry);
  }
  for (const { idWallet, amountDelta } of apply) {
    const entry = map.get(idWallet) ?? { balanceDelta: 0, countDelta: 0 };
    entry.balanceDelta += amountDelta;
    entry.countDelta += 1;
    map.set(idWallet, entry);
  }
  return map;
}

async function applyWalletDeltaMap(
  idUser: string,
  deltas: Map<string, { balanceDelta: number; countDelta: number }>,
  session: mongoose.ClientSession,
): Promise<void> {
  for (const [idWallet, { balanceDelta, countDelta }] of deltas) {
    if (balanceDelta === 0 && countDelta === 0) continue;
    await WalletModel.updateOne(
      { _id: idWallet, idUser },
      { $inc: { balance: balanceDelta, transactionCount: countDelta } },
      { session },
    );
  }
}

interface CategoryEffectSource {
  idCategory: string | null;
  idSubCategory: string | null;
}

async function applyCategoryCountDelta(
  idUser: string,
  idCategory: string,
  categoryDelta: number,
  subCategoryDeltas: Record<string, number>,
  session: mongoose.ClientSession,
): Promise<void> {
  if (categoryDelta !== 0) {
    await CategoryModel.updateOne(
      { _id: idCategory, idUser },
      { $inc: { transactionCount: categoryDelta } },
      { session },
    );
  }
  for (const [idSubCategory, delta] of Object.entries(subCategoryDeltas)) {
    if (delta === 0) continue;
    await CategoryModel.updateOne(
      { _id: idCategory, idUser, "subCategories._id": idSubCategory },
      { $inc: { "subCategories.$.transactionCount": delta } },
      { session },
    );
  }
}

async function applyCategoryDelta(
  idUser: string,
  revert: CategoryEffectSource,
  apply: CategoryEffectSource,
  session: mongoose.ClientSession,
): Promise<void> {
  if (revert.idCategory === apply.idCategory) {
    if (!apply.idCategory) return;
    const subDeltas: Record<string, number> = {};
    if (revert.idSubCategory) subDeltas[revert.idSubCategory] = (subDeltas[revert.idSubCategory] ?? 0) - 1;
    if (apply.idSubCategory) subDeltas[apply.idSubCategory] = (subDeltas[apply.idSubCategory] ?? 0) + 1;
    await applyCategoryCountDelta(idUser, apply.idCategory, 0, subDeltas, session);
    return;
  }

  if (revert.idCategory) {
    await applyCategoryCountDelta(
      idUser,
      revert.idCategory,
      -1,
      revert.idSubCategory ? { [revert.idSubCategory]: -1 } : {},
      session,
    );
  }
  if (apply.idCategory) {
    await applyCategoryCountDelta(
      idUser,
      apply.idCategory,
      1,
      apply.idSubCategory ? { [apply.idSubCategory]: 1 } : {},
      session,
    );
  }
}

function effectSourceOf(doc: {
  type: TransactionType;
  amount: number;
  idWallet: string | null;
  idCategory: string | null;
  idSubCategory: string | null;
  idWalletFrom: string | null;
  idWalletTo: string | null;
}): WalletEffectSource & CategoryEffectSource {
  return {
    type: doc.type,
    amount: doc.amount,
    idWallet: doc.idWallet,
    idCategory: doc.idCategory,
    idSubCategory: doc.idSubCategory,
    idWalletFrom: doc.idWalletFrom,
    idWalletTo: doc.idWalletTo,
  };
}

export const TransactionService = {
  async getList(idUser: string, query: ITransactionListQuery): Promise<ITransactionListResult> {
    const filter = buildFilter(idUser, query);
    const sort = SORT_MAP[query.sort ?? "dateDesc"] ?? SORT_MAP.dateDesc;

    if (!query.page || !query.limit) {
      const [transactions, summary] = await Promise.all([
        TransactionModel.find(filter).sort(sort).lean(),
        computeSummary(idUser, filter),
      ]);
      return {
        transactions: transactions.map(toSafeTransaction),
        total: null,
        page: null,
        limit: null,
        totalPages: null,
        summary,
      };
    }

    const page = Number(query.page);
    const limit = Number(query.limit);
    const [transactions, total, summary] = await Promise.all([
      TransactionModel.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TransactionModel.countDocuments(filter),
      computeSummary(idUser, filter),
    ]);

    return {
      transactions: transactions.map(toSafeTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
      summary,
    };
  },

  async create(idUser: string, input: ICreateTransactionInput): Promise<ISafeTransaction> {
    await validatePayload(idUser, input);
    const normalized = normalizeInput(input);

    const session = await mongoose.startSession();
    try {
      let created: any;
      await session.withTransaction(async () => {
        const [doc] = await TransactionModel.create([{ idUser, ...normalized }], { session });
        created = doc;

        const walletDeltas = accumulateWalletDeltas([], getWalletDeltas(normalized));
        await applyWalletDeltaMap(idUser, walletDeltas, session);

        await applyCategoryDelta(
          idUser,
          { idCategory: null, idSubCategory: null },
          { idCategory: normalized.idCategory, idSubCategory: normalized.idSubCategory },
          session,
        );
      });
      return toSafeTransaction(created);
    } finally {
      await session.endSession();
    }
  },

  async update(
    idUser: string,
    idTransaction: string,
    input: IUpdateTransactionInput,
  ): Promise<ISafeTransaction> {
    await validatePayload(idUser, input);
    const normalized = normalizeInput(input);

    const session = await mongoose.startSession();
    try {
      let updated: any;
      await session.withTransaction(async () => {
        const existing = await TransactionModel.findOne({ _id: idTransaction, idUser }).session(session);
        if (!existing) throw new Error("Transaksi tidak ditemukan");

        const revertSource = effectSourceOf(existing);
        const applySource = effectSourceOf({ ...normalized, idUser } as any);

        const walletDeltas = accumulateWalletDeltas(
          getWalletDeltas(revertSource),
          getWalletDeltas(applySource),
        );
        await applyWalletDeltaMap(idUser, walletDeltas, session);

        await applyCategoryDelta(idUser, revertSource, applySource, session);

        existing.set(normalized);
        await existing.save({ session });
        updated = existing;
      });
      return toSafeTransaction(updated);
    } finally {
      await session.endSession();
    }
  },

  async remove(idUser: string, idTransaction: string): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await TransactionModel.findOne({ _id: idTransaction, idUser }).session(session);
        if (!existing) throw new Error("Transaksi tidak ditemukan");

        const revertSource = effectSourceOf(existing);

        const walletDeltas = accumulateWalletDeltas(getWalletDeltas(revertSource), []);
        await applyWalletDeltaMap(idUser, walletDeltas, session);

        await applyCategoryDelta(
          idUser,
          revertSource,
          { idCategory: null, idSubCategory: null },
          session,
        );

        await TransactionModel.deleteOne({ _id: idTransaction, idUser }).session(session);
      });
    } finally {
      await session.endSession();
    }
  },
};
