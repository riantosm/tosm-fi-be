import mongoose, { Schema } from "mongoose";
import { IBudget, IChildLimit } from "../interfaces/budget.interface";

// No `_id` on each entry — a child limit is identified by its
// idCategory/idSubCategory pair, not an internal id, and the whole array is
// always replaced wholesale on update (never mutated by a per-item `.id()`
// lookup the way Category.subCategories is).
const ChildLimitSchema = new Schema<IChildLimit>(
  {
    idCategory: { type: String, required: true },
    idSubCategory: { type: String, default: null },
    limitAmount: { type: Number, required: true },
  },
  { _id: false },
);

const BudgetSchema = new Schema<IBudget>(
  {
    idUser: { type: String, required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    idCategories: { type: [String], default: [] },
    limitAmount: { type: Number, required: true },
    childLimits: { type: [ChildLimitSchema], default: [] },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const BudgetModel = mongoose.model<IBudget>("Budget", BudgetSchema);
