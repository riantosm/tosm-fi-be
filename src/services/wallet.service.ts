import {
  ICreateWalletInput,
  ISafeWallet,
  IUpdateWalletInput,
} from "../interfaces/wallet.interface";
import { WalletModel } from "../models/wallet.model";

const toSafeWallet = (wallet: any): ISafeWallet => ({
  idWallet: wallet._id.toString(),
  nameWallet: wallet.nameWallet,
  color: wallet.color,
  balance: wallet.balance,
  transactionCount: wallet.transactionCount,
  isPrimary: wallet.isPrimary,
});

export const WalletService = {
  async getList(idUser: string): Promise<ISafeWallet[]> {
    const wallets = await WalletModel.find({ idUser }).sort({ order: 1, createdAt: 1 }).lean();
    return wallets.map(toSafeWallet);
  },

  async create(idUser: string, input: ICreateWalletInput): Promise<ISafeWallet> {
    const order = await WalletModel.countDocuments({ idUser });
    const wallet = await WalletModel.create({
      idUser,
      nameWallet: input.nameWallet,
      color: input.color,
      balance: input.balance ?? 0,
      order,
    });
    return toSafeWallet(wallet);
  },

  async update(
    idUser: string,
    idWallet: string,
    input: IUpdateWalletInput
  ): Promise<ISafeWallet> {
    const wallet = await WalletModel.findOne({ _id: idWallet, idUser });
    if (!wallet) throw new Error("Wallet tidak ditemukan");

    wallet.nameWallet = input.nameWallet;
    wallet.color = input.color;
    await wallet.save();

    return toSafeWallet(wallet);
  },

  async remove(idUser: string, idWallet: string): Promise<void> {
    const wallet = await WalletModel.findOneAndDelete({ _id: idWallet, idUser });
    if (!wallet) throw new Error("Wallet tidak ditemukan");
  },

  async setPrimary(idUser: string, idWallet: string): Promise<ISafeWallet[]> {
    const target = await WalletModel.findOne({ _id: idWallet, idUser });
    if (!target) throw new Error("Wallet tidak ditemukan");

    await WalletModel.updateMany({ idUser }, { isPrimary: false });
    target.isPrimary = true;
    await target.save();

    return WalletService.getList(idUser);
  },

  async reorder(idUser: string, orderedIds: string[]): Promise<ISafeWallet[]> {
    await Promise.all(
      orderedIds.map((idWallet, order) =>
        WalletModel.updateOne({ _id: idWallet, idUser }, { order })
      )
    );
    return WalletService.getList(idUser);
  },
};
