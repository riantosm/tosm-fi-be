import mongoose, { Schema } from "mongoose";
import { ITransaction } from "../interfaces/transaction.interface";

const TransactionSchema = new Schema<ITransaction>({
  id_transaction: { type: Number, required: true },
  id_account: { type: Number, required: true },
  amount: { type: Number, required: true },
  id_transaction_type: { type: Number, required: true },
  description_transaction: { type: String, required: false, default: null },
  date: { type: Number, required: true },
});

export const TransactionModel = mongoose.model<ITransaction>(
  "Transaction",
  TransactionSchema
);
