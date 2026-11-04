import {
  ICreateWalletInput,
  ISafeWallet,
  IUpdateWalletInput,
} from "../interfaces/wallet.interface";
import { WalletModel } from "../models/wallet.model";
import { Cloudinary, IUploadImage } from "../utils/cloudinary";

const toSafeWallet = (wallet: any): ISafeWallet => ({
  idWallet: wallet._id.toString(),
  nameWallet: wallet.nameWallet,
  color: wallet.color,
  balance: wallet.balance,
  transactionCount: wallet.transactionCount,
  isPrimary: wallet.isPrimary,
  logoUrl: wallet.logoUrl ?? null,
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
    await Cloudinary.destroyQuietly([wallet.logoPublicId]);
  },

  async setLogo(idUser: string, idWallet: string, image: IUploadImage): Promise<ISafeWallet> {
    const wallet = await WalletModel.findOne({ _id: idWallet, idUser });
    if (!wallet) throw new Error("Wallet tidak ditemukan");

    // Named after the wallet id, so a new logo overwrites the previous file.
    const uploaded = await Cloudinary.upload("wallet", idWallet, image);
    wallet.logoUrl = uploaded.url;
    wallet.logoPublicId = uploaded.publicId;
    await wallet.save();

    return toSafeWallet(wallet);
  },

  async removeLogo(idUser: string, idWallet: string): Promise<ISafeWallet> {
    const wallet = await WalletModel.findOne({ _id: idWallet, idUser });
    if (!wallet) throw new Error("Wallet tidak ditemukan");

    const publicId = wallet.logoPublicId;
    wallet.logoUrl = null;
    wallet.logoPublicId = null;
    await wallet.save();
    await Cloudinary.destroyQuietly([publicId]);

    return toSafeWallet(wallet);
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
