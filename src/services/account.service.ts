import mongoose from "mongoose";
import { CategoryModel } from "../models/category.model";
import { InstrumentModel } from "../models/instrument.model";
import { InvestmentTransactionModel } from "../models/investment-transaction.model";
import { TransactionModel } from "../models/transaction.model";
import { WalletModel } from "../models/wallet.model";

export const AccountService = {
  async resetData(idUser: string): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await TransactionModel.deleteMany({ idUser }).session(session);
        await InvestmentTransactionModel.deleteMany({ idUser }).session(session);
        await WalletModel.deleteMany({ idUser }).session(session);
        await CategoryModel.deleteMany({ idUser }).session(session);
        await InstrumentModel.deleteMany({ idUser }).session(session);
      });
    } finally {
      await session.endSession();
    }
  },
};
