import { AccountTypeModel } from "../models/accountType.model";
import { IAccountType } from "../interfaces/accountType.interface";

export const AccountTypeService = {
  async getAll(): Promise<IAccountType[]> {
    return await AccountTypeModel.find();
  },

  async getById(id: number): Promise<IAccountType | null> {
    return await AccountTypeModel.findOne({ id_account_type: id });
  },

  async create(data: IAccountType): Promise<IAccountType> {
    const newType = new AccountTypeModel(data);
    return await newType.save();
  },

  async update(
    id: number,
    data: Partial<IAccountType>
  ): Promise<IAccountType | null> {
    const { id_account_type, ...safeData } = data;
    return await AccountTypeModel.findOneAndUpdate(
      { id_account_type: id },
      safeData,
      { new: true }
    );
  },

  async delete(id: number): Promise<boolean> {
    const result = await AccountTypeModel.deleteOne({ id_account_type: id });
    return result.deletedCount > 0;
  },
};
