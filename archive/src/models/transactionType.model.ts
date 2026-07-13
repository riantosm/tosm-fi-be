import mongoose, { Schema } from "mongoose";
import { ITransactionType } from "../interfaces/transactionType.interface";

const TransactionTypeSchema = new Schema<ITransactionType>({
  id_transaction_type: { type: Number, required: true, unique: true },
  name_transaction_type: { type: String, required: true },
});

export const TransactionTypeModel = mongoose.model<ITransactionType>(
  "TransactionType",
  TransactionTypeSchema
);
