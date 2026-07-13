import mongoose, { Schema } from "mongoose";
import { IWallet } from "../interfaces/wallet.interface";

const WalletSchema = new Schema<IWallet>(
  {
    idUser: { type: String, required: true, index: true },
    nameWallet: { type: String, required: true },
    color: { type: String, required: true },
    balance: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const WalletModel = mongoose.model<IWallet>("Wallet", WalletSchema);
