import mongoose, { Schema } from "mongoose";
import { IAccount } from "../interfaces/account.interface";

const AccountSchema = new Schema<IAccount>({
  id_account: { type: Number, required: true, unique: true },
  name_account: { type: String, required: true },
  id_account_type: { type: Number, required: false, default: null },
});

export const AccountModel = mongoose.model<IAccount>("Account", AccountSchema);
