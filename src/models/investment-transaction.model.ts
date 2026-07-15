import mongoose, { Schema } from "mongoose";
import { IInvestmentTransaction } from "../interfaces/investment-transaction.interface";

const InvestmentTransactionSchema = new Schema<IInvestmentTransaction>(
  {
    idUser: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["in", "out", "transfer", "pl"],
      required: true,
    },
    date: { type: Date, required: true },
    idInstrument: { type: String, required: true },
    idInvestmentAccount: { type: String, required: true },
    idInstrumentTo: { type: String, default: null },
    idInvestmentAccountTo: { type: String, default: null },
    amount: { type: Number, required: true },
    investedDelta: { type: Number, required: true },
    currentDelta: { type: Number, required: true },
    idTransaction: { type: String, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

// Supports the default dateDesc list, scoped per user.
InvestmentTransactionSchema.index({ idUser: 1, date: -1 });
// Supports the cascade-delete lookup from transaction.service.ts.
InvestmentTransactionSchema.index({ idUser: 1, idTransaction: 1 });

export const InvestmentTransactionModel = mongoose.model<IInvestmentTransaction>(
  "InvestmentTransaction",
  InvestmentTransactionSchema
);
