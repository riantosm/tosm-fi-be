import { AccountModel } from "../models/account.model";
import { IAccount } from "../interfaces/account.interface";
import { AccountTypeModel } from "../models/accountType.model";
import { TransactionModel } from "../models/transaction.model";
import mongoose from "mongoose";

export const AccountService = {
  async getAll() {
    const accounts = await AccountModel.find().lean();

    const accountTypes = await AccountTypeModel.find();
    const typeMapName = new Map(
      accountTypes.map((t) => [t.id_account_type, t.name_account_type])
    );
    const typeMapColor = new Map(
      accountTypes.map((t) => [t.id_account_type, t.color])
    );
    const result = accounts.map((acc) => ({
      ...acc,
      name_account_type: typeMapName.get(acc.id_account_type) || "Unknown",
      color: typeMapColor.get(acc.id_account_type),
    }));

    return result;
  },

  async getById(id: number) {
    const account = await AccountModel.findOne({ id_account: id }).lean();
    if (!account) return null;

    const accountType = await AccountTypeModel.findOne({
      id_account_type: account.id_account_type,
    }).lean();

    return {
      ...account,
      name_account_type: accountType?.name_account_type || "Unknown",
      color: accountType?.color,
    };
  },

  async create(data: IAccount) {
    const accountTypeExists = await AccountTypeModel.findOne({
      id_account_type: data.id_account_type,
    });
    // if (!accountTypeExists) {
    //   throw new Error("Account type not found");
    // }

    const newAccount = await AccountModel.create(data);
    return newAccount;
  },

  async update(id: number, data: Partial<IAccount>): Promise<IAccount | null> {
    return await AccountModel.findOneAndUpdate({ id_account: id }, data, {
      new: true,
    });
  },

  async delete(id: number): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const accDel = await AccountModel.deleteOne({ id_account: id }).session(
        session
      );

      if (!accDel.deletedCount) {
        await session.abortTransaction();
        return false;
      }

      await TransactionModel.deleteMany({ id_account: id }).session(session);

      await session.commitTransaction();
      return true;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },
};
