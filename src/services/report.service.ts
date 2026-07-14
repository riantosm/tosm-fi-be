import { TransactionModel } from "../models/transaction.model";
import { WalletModel } from "../models/wallet.model";
import { CategoryModel } from "../models/category.model";
import { buildDateFilter, computeSummary } from "./transaction.service";
import {
  ICashFlowPoint,
  IMonthlyTrendPoint,
  IReportSummary,
  ITopSpendingItem,
  IWalletUsageItem,
} from "../interfaces/report.interface";
import { buildReportBuckets, formatMonthShortLabel, generateMonthRangeUtc } from "../utils/reportBuckets";

function computeChangePercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function periodFilter(idUser: string, dateFrom: string, dateTo: string): Record<string, any> {
  return { idUser, date: buildDateFilter({ dateFrom, dateTo }) };
}

export const ReportService = {
  // Computes both the current and previous period aggregates (and their comparison) in one
  // call instead of two, so the summary cards need a single round trip.
  async getSummary(
    idUser: string,
    dateFrom: string,
    dateTo: string,
    previousDateFrom: string,
    previousDateTo: string,
  ): Promise<IReportSummary> {
    const currentFilter = periodFilter(idUser, dateFrom, dateTo);
    const previousFilter = periodFilter(idUser, previousDateFrom, previousDateTo);

    const [current, currentCount, previous, previousCount] = await Promise.all([
      computeSummary(idUser, currentFilter),
      TransactionModel.countDocuments(currentFilter),
      computeSummary(idUser, previousFilter),
      TransactionModel.countDocuments(previousFilter),
    ]);

    const currentNet = current.income - current.expense;
    const previousNet = previous.income - previous.expense;

    return {
      totalIncome: {
        value: current.income,
        changePercent: computeChangePercent(current.income, previous.income),
      },
      totalExpense: {
        value: current.expense,
        changePercent: computeChangePercent(current.expense, previous.expense),
      },
      netCashFlow: {
        value: currentNet,
        changePercent: computeChangePercent(currentNet, previousNet),
      },
      transactionCount: {
        value: currentCount,
        changePercent: computeChangePercent(currentCount, previousCount),
      },
      categoryBreakdown: current.categoryBreakdown,
    };
  },

  // One aggregation over every wallet at once (a transaction can count toward up to two
  // wallets — both transfer legs) instead of one query per wallet.
  async getWalletUsage(idUser: string, dateFrom: string, dateTo: string): Promise<IWalletUsageItem[]> {
    const dateFilter = buildDateFilter({ dateFrom, dateTo });

    const [wallets, grouped] = await Promise.all([
      WalletModel.find({ idUser }).sort({ order: 1, createdAt: 1 }).lean(),
      TransactionModel.aggregate([
        { $match: { idUser, date: dateFilter } },
        {
          $project: {
            wallets: {
              $filter: {
                input: ["$idWallet", "$idWalletFrom", "$idWalletTo"],
                as: "w",
                cond: { $ne: ["$$w", null] },
              },
            },
          },
        },
        { $unwind: "$wallets" },
        { $group: { _id: "$wallets", transactionCount: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map<string, number>(grouped.map((g) => [g._id as string, g.transactionCount as number]));
    const totalCount = grouped.reduce((sum, g) => sum + g.transactionCount, 0);

    return wallets
      .map((wallet) => {
        const idWallet = wallet._id.toString();
        const transactionCount = countMap.get(idWallet) ?? 0;
        return {
          idWallet,
          nameWallet: wallet.nameWallet,
          color: wallet.color,
          transactionCount,
          percentage: totalCount > 0 ? (transactionCount / totalCount) * 100 : 0,
        };
      })
      .filter((item) => item.transactionCount > 0)
      .sort((a, b) => b.transactionCount - a.transactionCount);
  },

  async getTopSpending(
    idUser: string,
    dateFrom: string,
    dateTo: string,
    limit: number,
  ): Promise<ITopSpendingItem[]> {
    const dateFilter = buildDateFilter({ dateFrom, dateTo });

    const transactions = await TransactionModel.find({ idUser, type: "expense", date: dateFilter })
      .sort({ amount: -1 })
      .limit(limit)
      .lean();

    const categoryIds = [
      ...new Set(transactions.map((t) => t.idCategory).filter((id): id is string => Boolean(id))),
    ];
    const categories = categoryIds.length
      ? await CategoryModel.find({ _id: { $in: categoryIds }, idUser })
      : [];
    const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));

    return transactions.map((transaction, index) => {
      const category = transaction.idCategory ? categoryMap.get(transaction.idCategory) : undefined;
      const subCategory =
        transaction.idSubCategory && category ? category.subCategories.id(transaction.idSubCategory) : null;
      return {
        idTransaction: transaction._id.toString(),
        rank: index + 1,
        title: transaction.title || category?.nameCategory || "-",
        categoryName: category?.nameCategory ?? "-",
        subCategoryName: subCategory?.nameSubCategory ?? null,
        amount: Math.abs(transaction.amount),
        date: transaction.date.toISOString(),
      };
    });
  },

  // Needs itemized transactions to bucket by hour/day/week/month (buildReportBuckets, ported
  // 1:1 from the frontend's former client-side bucketing) — no aggregate can give this, so it
  // stays a find() + in-memory bucket sum instead of a $group pipeline.
  async getCashFlow(
    idUser: string,
    dateFrom: string,
    dateTo: string,
    locale: string,
  ): Promise<ICashFlowPoint[]> {
    const dateFilter = buildDateFilter({ dateFrom, dateTo });
    const transactions = await TransactionModel.find({ idUser, date: dateFilter })
      .select("type amount date")
      .lean();

    const buckets = buildReportBuckets(dateFrom, dateTo, locale);
    const now = Date.now();

    return buckets.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const transaction of transactions) {
        const time = transaction.date.getTime();
        if (time < bucket.start.getTime() || time > bucket.end.getTime()) continue;
        if (transaction.type === "income") income += transaction.amount;
        if (transaction.type === "expense") expense += Math.abs(transaction.amount);
      }
      return {
        label: bucket.label,
        income,
        expense,
        isToday: now >= bucket.start.getTime() && now <= bucket.end.getTime(),
      };
    });
  },

  // Returns both income and expense per month in one call so the FE can toggle the
  // Pengeluaran/Pemasukan metric without refetching.
  async getMonthlyTrend(idUser: string, monthsCount: number, locale: string): Promise<IMonthlyTrendPoint[]> {
    const months = generateMonthRangeUtc(new Date(), monthsCount - 1, 0);
    const rangeStart = months[0];
    const rangeEnd = new Date(
      Date.UTC(months[months.length - 1].getUTCFullYear(), months[months.length - 1].getUTCMonth() + 1, 1),
    );

    const grouped = await TransactionModel.aggregate([
      {
        $match: {
          idUser,
          type: { $in: ["income", "expense"] },
          date: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totals = new Map<string, { income: number; expense: number }>();
    for (const g of grouped) {
      const key = `${g._id.year}-${g._id.month}`;
      const entry = totals.get(key) ?? { income: 0, expense: 0 };
      if (g._id.type === "income") entry.income = g.total;
      else entry.expense = g.total;
      totals.set(key, entry);
    }

    return months.map((month) => {
      const key = `${month.getUTCFullYear()}-${month.getUTCMonth() + 1}`;
      const entry = totals.get(key) ?? { income: 0, expense: 0 };
      return { label: formatMonthShortLabel(month, locale), income: entry.income, expense: entry.expense };
    });
  },
};
