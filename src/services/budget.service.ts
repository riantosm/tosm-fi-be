import {
  ICreateBudgetInput,
  ISafeBudget,
  ISafeChildLimit,
  IUpdateBudgetInput,
} from "../interfaces/budget.interface";
import { BudgetModel } from "../models/budget.model";

const toSafeChildLimit = (limit: any): ISafeChildLimit => ({
  idCategory: limit.idCategory,
  idSubCategory: limit.idSubCategory,
  limitAmount: limit.limitAmount,
});

// `idCategories`/`isPinned` default via the schema for documents created
// after this field was added, but `.lean()` reads skip Mongoose defaults for
// fields genuinely absent from an older stored document — fall back here so
// pre-existing budgets don't come back with `undefined`.
const toSafeBudget = (budget: any): ISafeBudget => ({
  idBudget: budget._id.toString(),
  name: budget.name,
  color: budget.color,
  idCategories: budget.idCategories ?? [],
  limitAmount: budget.limitAmount,
  childLimits: budget.childLimits.map(toSafeChildLimit),
  isPinned: budget.isPinned ?? false,
});

async function findOwnedBudget(idUser: string, idBudget: string) {
  const budget = await BudgetModel.findOne({ _id: idBudget, idUser });
  if (!budget) throw new Error("Anggaran tidak ditemukan");
  return budget;
}

export const BudgetService = {
  async getList(idUser: string): Promise<ISafeBudget[]> {
    const budgets = await BudgetModel.find({ idUser }).sort({ createdAt: 1 }).lean();
    return budgets.map(toSafeBudget);
  },

  async create(idUser: string, input: ICreateBudgetInput): Promise<ISafeBudget> {
    const budget = await BudgetModel.create({
      idUser,
      name: input.name,
      color: input.color,
      idCategories: input.idCategories,
      limitAmount: input.limitAmount,
      childLimits: [],
      isPinned: input.isPinned ?? false,
    });
    return toSafeBudget(budget);
  },

  // A genuine partial patch — only touches fields the caller actually sent,
  // so `{ childLimits }` alone (the "set a single row's limit" flow) never
  // clobbers name/color/limitAmount. Unlike category's update(), which
  // requires the full payload every time.
  async update(idUser: string, idBudget: string, input: IUpdateBudgetInput): Promise<ISafeBudget> {
    const budget = await findOwnedBudget(idUser, idBudget);
    if (input.name !== undefined) budget.name = input.name;
    if (input.color !== undefined) budget.color = input.color;
    if (input.idCategories !== undefined) budget.idCategories = input.idCategories;
    if (input.limitAmount !== undefined) budget.limitAmount = input.limitAmount;
    if (input.childLimits !== undefined) budget.childLimits = input.childLimits;
    if (input.isPinned !== undefined) budget.isPinned = input.isPinned;
    await budget.save();
    return toSafeBudget(budget);
  },

  async remove(idUser: string, idBudget: string): Promise<void> {
    const budget = await BudgetModel.findOneAndDelete({ _id: idBudget, idUser });
    if (!budget) throw new Error("Anggaran tidak ditemukan");
  },
};
