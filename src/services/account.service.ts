import mongoose from "mongoose";
import { BudgetModel } from "../models/budget.model";
import { CategoryModel } from "../models/category.model";
import { InstrumentModel } from "../models/instrument.model";
import { InvestmentTransactionModel } from "../models/investment-transaction.model";
import { TransactionModel } from "../models/transaction.model";
import { WalletModel } from "../models/wallet.model";
import { Cloudinary } from "../utils/cloudinary";

export const AccountService = {
  async resetData(idUser: string): Promise<void> {
    const logoIds = await WalletModel.distinct("logoPublicId", { idUser });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await TransactionModel.deleteMany({ idUser }).session(session);
        await InvestmentTransactionModel.deleteMany({ idUser }).session(session);
        await WalletModel.deleteMany({ idUser }).session(session);
        await CategoryModel.deleteMany({ idUser }).session(session);
        await InstrumentModel.deleteMany({ idUser }).session(session);
        await BudgetModel.deleteMany({ idUser }).session(session);
      });
    } finally {
      await session.endSession();
    }
    // Only after the wipe committed — a rolled-back reset must keep its logos.
    await Cloudinary.destroyQuietly(logoIds);
  },
};
