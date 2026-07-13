import { TransactionTypeModel } from "../models/transactionType.model";
import { ITransactionType } from "../interfaces/transactionType.interface";

export const TransactionTypeService = {
  async getAll(): Promise<ITransactionType[]> {
    return await TransactionTypeModel.find();
  },

  async getById(id: number): Promise<ITransactionType | null> {
    return await TransactionTypeModel.findOne({ id_transaction_type: id });
  },

  async create(data: ITransactionType): Promise<ITransactionType> {
    const newType = new TransactionTypeModel(data);
    return await newType.save();
  },

  async update(
    id: number,
    data: Partial<ITransactionType>
  ): Promise<ITransactionType | null> {
    const { id_transaction_type, ...safeData } = data;
    return await TransactionTypeModel.findOneAndUpdate(
      { id_transaction_type: id },
      safeData,
      { new: true }
    );
  },

  async delete(id: number): Promise<boolean> {
    const result = await TransactionTypeModel.deleteOne({
      id_transaction_type: id,
    });
    return result.deletedCount > 0;
  },
};
