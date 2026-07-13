import { TransactionModel } from "../models/transaction.model";
import { AccountModel } from "../models/account.model";
import { TransactionTypeModel } from "../models/transactionType.model";
import {
  IProfitInput,
  ITransaction,
  ITransferInput,
  TransactionFilter,
  TransactionWithExtra,
} from "../interfaces/transaction.interface";
import { formatTimestamp } from "../utils/formatTimestamp";
import { formatCurrency } from "../utils/formatCurrency";
import { Types } from "mongoose";

export const TransactionService = {
  async getAll(filter: TransactionFilter = {}): Promise<{
    data: TransactionWithExtra[];
    total: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  }> {
    const {
      id_account,
      id_transaction_type,
      search,
      start_date,
      end_date,
      sort_by = "date",
      sort_order = "desc",
      page,
      limit,
    } = filter;

    const query: any = {};
    if (id_account) query.id_account = id_account;
    if (id_transaction_type) query.id_transaction_type = id_transaction_type;

    if (start_date || end_date) {
      query.date = {};
      if (start_date) query.date.$gte = start_date;
      if (end_date) query.date.$lte = end_date;
    }

    const sortObj: any =
      sort_by === "amount"
        ? { amount: sort_order === "asc" ? 1 : -1 }
        : {
            date: sort_order === "asc" ? 1 : -1,
            id_transaction: sort_order === "asc" ? 1 : -1,
          };

    const total = await TransactionModel.countDocuments(query);

    let dbQuery = TransactionModel.find(query).sort(sortObj).lean();

    let currentPage: number | undefined = undefined;
    let currentLimit: number | undefined = undefined;
    let totalPages: number | undefined = undefined;

    if (page && limit) {
      const p = Number(page);
      const l = Number(limit);
      currentPage = p;
      currentLimit = l;
      totalPages = Math.ceil(total / l);
      dbQuery = dbQuery.skip((p - 1) * l).limit(l);
    }

    const transactions = await dbQuery;

    const [accounts, transactionTypes] = await Promise.all([
      AccountModel.find().lean(),
      TransactionTypeModel.find().lean(),
    ]);

    const accountMap = new Map(
      accounts.map((a) => [a.id_account, a.name_account])
    );
    const typeMap = new Map(
      transactionTypes.map((t) => [
        t.id_transaction_type,
        t.name_transaction_type,
      ])
    );

    // @ts-ignore
    let result: TransactionWithExtra[] = transactions.map((trx) => ({
      ...trx, // amount tetap sama
      name_account: accountMap.get(trx.id_account) || null,
      name_transaction_type: typeMap.get(trx.id_transaction_type) || null,
      date_formated: formatTimestamp(trx.date),
    }));

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (trx) =>
          trx.id_transaction?.toString().includes(s) ||
          trx.name_account?.toLowerCase().includes(s) ||
          trx.description_transaction?.toLowerCase().includes(s)
      );
    }

    return {
      data: result,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages,
    };
  },

  async getById(id_transaction: number): Promise<any | null> {
    const trx = await TransactionModel.findOne({ id_transaction }).lean();
    if (!trx) return null;

    const account = await AccountModel.findOne({
      id_account: trx.id_account,
    }).lean();
    const trxType = await TransactionTypeModel.findOne({
      id_transaction_type: trx.id_transaction_type,
    }).lean();

    return {
      ...trx,
      name_account: account?.name_account || null,
      name_transaction_type: trxType?.name_transaction_type || null,
      date_formated: formatTimestamp(trx.date),
    };
  },

  async create(data: ITransaction): Promise<ITransaction> {
    const account = await AccountModel.findOne({ id_account: data.id_account });
    if (!account) throw new Error("Account not found");

    const trxType = await TransactionTypeModel.findOne({
      id_transaction_type: data.id_transaction_type,
    });
    if (!trxType) throw new Error("Transaction type not found");

    if (data.id_transaction_type == -1) {
      data.amount = Math.abs(Number(data.amount)) * -1;
    }

    const newTransaction = new TransactionModel(data);
    return newTransaction.save();
  },

  async update(
    id_transaction: number,
    data: Partial<ITransaction>
  ): Promise<ITransaction | null> {
    const existing = await TransactionModel.findOne({ id_transaction });
    if (!existing) throw new Error("Transaction not found");

    if (data.id_account) {
      const acc = await AccountModel.findOne({ id_account: data.id_account });
      if (!acc) throw new Error("Account not found");
    }

    if (data.id_transaction_type) {
      const type = await TransactionTypeModel.findOne({
        id_transaction_type: data.id_transaction_type,
      });
      if (!type) throw new Error("Transaction type not found");
    }

    const finalType = data.id_transaction_type ?? existing.id_transaction_type;

    if (finalType == -1 && typeof Number(data.amount) === "number") {
      data.amount = Math.abs(Number(data.amount)) * -1;
    }

    return TransactionModel.findOneAndUpdate({ id_transaction }, data, {
      new: true,
    });
  },

  async delete(id_transaction: number): Promise<{ deletedCount: number }> {
    const result = await TransactionModel.deleteMany({ id_transaction });
    return { deletedCount: result.deletedCount || 0 };
  },

  async resetTransactions(id_account?: number): Promise<number> {
    let filter = {};
    if (id_account) {
      filter = { id_account };
    }

    const result = await TransactionModel.deleteMany(filter);
    return result.deletedCount || 0;
  },

  async transfer(input: ITransferInput): Promise<ITransaction[]> {
    const { from_id_account, to_id_account, amount: a, date } = input;
    const amount = Number(a);

    if (from_id_account === to_id_account) {
      throw new Error("Cannot transfer to the same account");
    }

    const fromAccount = await AccountModel.findOne({
      id_account: from_id_account,
    });
    if (!fromAccount) throw new Error("From account not found");

    const toAccount = await AccountModel.findOne({ id_account: to_id_account });
    if (!toAccount) throw new Error("To account not found");

    if (amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const id_transaction = Math.floor(Date.now() / 1000);

    // Pilihan emot
    const plusEmot = "➕"; // bisa diganti: "+", "✅"
    const minusEmot = "➖"; // bisa diganti: "-", "❌"
    const arrowEmot = "➔"; // bisa diganti: "→", "⇒", "➔"

    const transactions: ITransaction[] = [
      {
        id_transaction,
        id_account: from_id_account,
        amount: -Math.abs(amount),
        id_transaction_type: 2,
        description_transaction: `Pemindahan saldo`,
        date,
      },
      {
        id_transaction,
        id_account: to_id_account,
        amount: Math.abs(amount),
        id_transaction_type: 2,
        description_transaction: `Pemindahan saldo`,
        date,
      },
    ];

    const saved = await TransactionModel.insertMany(transactions);

    return saved;
  },

  async profit(input: IProfitInput): Promise<ITransaction> {
    const { id_account, amount, date } = input;

    const totalTransactions = await TransactionModel.aggregate([
      { $match: { id_account: Number(id_account) } },
      { $group: { _id: "$id_account", total: { $sum: "$amount" } } },
    ]);

    const currentTotal = totalTransactions[0]?.total || 0;

    const profitAmount = amount - currentTotal;

    const newTransaction: ITransaction = {
      id_transaction: Math.floor(Date.now() / 1000),
      id_account,
      amount: profitAmount,
      id_transaction_type: 3,
      description_transaction: "P/L",
      date,
    };

    const saved = await TransactionModel.create(newTransaction);

    return saved;
  },
};
