import mongoose, { Schema } from "mongoose";
import { IInstrument, IInvestmentAccount } from "../interfaces/instrument.interface";

const InvestmentAccountSchema = new Schema<IInvestmentAccount>({
  nameInvestmentAccount: { type: String, required: true },
  investedAmount: { type: Number, default: 0 },
  currentValue: { type: Number, default: 0 },
});

const InstrumentSchema = new Schema<IInstrument>(
  {
    idUser: { type: String, required: true, index: true },
    nameInstrument: { type: String, required: true },
    color: { type: String, required: true },
    // Embedded, not a separate collection — an investment account never
    // exists outside its parent instrument, so deleting the instrument
    // deletes them for free. Same reasoning as Category.subCategories.
    investmentAccounts: { type: [InvestmentAccountSchema], default: [] },
  },
  { timestamps: true }
);

export const InstrumentModel = mongoose.model<IInstrument>("Instrument", InstrumentSchema);
