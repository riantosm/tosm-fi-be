import mongoose, { Schema } from "mongoose";
import { IAccountType } from "../interfaces/accountType.interface";

const AccountTypeSchema = new Schema<IAccountType>({
  id_account_type: { type: Number, required: true, unique: true },
  name_account_type: { type: String, required: true },
  color: { type: String, required: true, default: "#d4d4d4" },
});

export const AccountTypeModel = mongoose.model<IAccountType>(
  "AccountType",
  AccountTypeSchema
);
