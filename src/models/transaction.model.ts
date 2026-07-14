import mongoose, { Schema } from "mongoose";
import { ITransaction } from "../interfaces/transaction.interface";

const TransactionSchema = new Schema<ITransaction>(
  {
    idUser: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["income", "expense", "transfer", "correction"],
      required: true,
    },
    idWallet: { type: String, default: null },
    idCategory: { type: String, default: null },
    idSubCategory: { type: String, default: null },
    idWalletFrom: { type: String, default: null },
    idWalletTo: { type: String, default: null },
    title: { type: String, required: true },
    notes: { type: String, default: "" },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

// Supports month/date-range filtering + default dateDesc sort scoped per user.
TransactionSchema.index({ idUser: 1, date: -1 });
// Supports the wallet/category filter chips without a full collection scan.
TransactionSchema.index({ idUser: 1, idWallet: 1 });
TransactionSchema.index({ idUser: 1, idCategory: 1 });

export const TransactionModel = mongoose.model<ITransaction>("Transaction", TransactionSchema);
