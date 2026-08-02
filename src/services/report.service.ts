import { TransactionModel } from "../models/transaction.model";
import { WalletModel } from "../models/wallet.model";
import { CategoryModel } from "../models/category.model";
import { InstrumentModel } from "../models/instrument.model";
import { InvestmentTransactionModel } from "../models/investment-transaction.model";
import { buildDateFilter, computeSummary } from "./transaction.service";
import {
  ICashFlowPoint,
  IDashboardSummary,
  IFinancialHealth,
  IMonthlyTrendPoint,
  IReportSummary,
  ITopSpendingItem,
  IWalletUsageItem,
} from "../interfaces/report.interface";
import { buildReportBuckets, formatMonthShortLabel, generateMonthRangeUtc } from "../utils/reportBuckets";
import { instantToLocalFieldsDate, shiftToInstant } from "../utils/timezone";

function computeChangePercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function periodFilter(
  idUser: string,
  dateFrom: string,
  dateTo: string,
  tzOffsetMinutes: number,
): Record<string, any> {
  return { idUser, date: buildDateFilter({ dateFrom, dateTo, tzOffsetMinutes }) };
}

// Score is the share of this month's income left over after BOTH spending and investing —
// expense and investmentInflow are each money leaving your immediately-available balance, so
// both get subtracted from income. E.g. income 1jt, expense 100rb, no investment -> 90% left;
// income 1jt, expense 100rb, invested 100rb -> 80% left. isCashFlowPositive/isExpenseStable
// stay income-vs-expense based; isExpenseStable uses an 80% of income threshold (common "spend
// at most 80%, save at least 20%" budgeting rule of thumb).
function computeFinancialHealth(income: number, expense: number, investmentInflow: number): IFinancialHealth {
  const savingRate = income > 0 ? Math.round(((income - expense - investmentInflow) / income) * 100) : 0;
  const isCashFlowPositive = income >= expense;
  const isExpenseStable = income > 0 ? expense <= income * 0.8 : expense === 0;
  const score = Math.max(0, Math.min(100, savingRate));
  const status = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "fair" : "needsAttention";

  return {
    score,
    status,
    savingRate,
    isCashFlowPositive,
    isExpenseStable,
  };
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
    tzOffsetMinutes: number,
  ): Promise<IReportSummary> {
    const currentFilter = periodFilter(idUser, dateFrom, dateTo, tzOffsetMinutes);
    const previousFilter = periodFilter(idUser, previousDateFrom, previousDateTo, tzOffsetMinutes);

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
  async getWalletUsage(
    idUser: string,
    dateFrom: string,
    dateTo: string,
    tzOffsetMinutes: number,
  ): Promise<IWalletUsageItem[]> {
    const dateFilter = buildDateFilter({ dateFrom, dateTo, tzOffsetMinutes });

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
    tzOffsetMinutes: number,
  ): Promise<ITopSpendingItem[]> {
    const dateFilter = buildDateFilter({ dateFrom, dateTo, tzOffsetMinutes });

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
    tzOffsetMinutes: number,
  ): Promise<ICashFlowPoint[]> {
    const dateFilter = buildDateFilter({ dateFrom, dateTo, tzOffsetMinutes });
    const transactions = await TransactionModel.find({ idUser, date: dateFilter })
      .select("type amount date")
      .lean();

    const buckets = buildReportBuckets(dateFrom, dateTo, locale, tzOffsetMinutes);
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
  async getMonthlyTrend(
    idUser: string,
    monthsCount: number,
    locale: string,
    tzOffsetMinutes: number,
  ): Promise<IMonthlyTrendPoint[]> {
    // `months` are the client's local calendar months, expressed via UTC-field arithmetic (see
    // src/utils/timezone.ts) so generateMonthRangeUtc's plain getUTC*/Date.UTC math treats them
    // as local fields. The query range is shifted back into real UTC instants for the $match.
    const localNow = instantToLocalFieldsDate(new Date(), tzOffsetMinutes);
    const months = generateMonthRangeUtc(localNow, monthsCount - 1, 0);
    const rangeStart = shiftToInstant(months[0], tzOffsetMinutes);
    const rangeEnd = shiftToInstant(
      new Date(
        Date.UTC(months[months.length - 1].getUTCFullYear(), months[months.length - 1].getUTCMonth() + 1, 1),
      ),
      tzOffsetMinutes,
    );

    const grouped = await TransactionModel.aggregate([
      {
        $match: {
          idUser,
          type: { $in: ["income", "expense"] },
          date: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      // Shift each transaction's real UTC instant back into the client's local calendar fields
      // (mirrors instantToLocalFieldsDate) before extracting $year/$month, so a transaction near
      // a local month boundary groups into the correct local month, not the UTC one.
      { $addFields: { localDate: { $dateAdd: { startDate: "$date", unit: "minute", amount: -tzOffsetMinutes } } } },
      {
        $group: {
          _id: { year: { $year: "$localDate" }, month: { $month: "$localDate" }, type: "$type" },
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
      return {
        label: formatMonthShortLabel(month, locale, tzOffsetMinutes),
        income: entry.income,
        expense: entry.expense,
      };
    });
  },

  // Combines three otherwise-unrelated domains (wallet balances, investment account values,
  // this month's income/expense) into a single call for the dashboard's overview cards, instead
  // of the frontend composing three separate requests.
  async getDashboardSummary(idUser: string, month: string, tzOffsetMinutes: number): Promise<IDashboardSummary> {
    const dateFilter = buildDateFilter({ month, tzOffsetMinutes });

    const [wallets, instruments, monthly, investmentInflowEntries] = await Promise.all([
      WalletModel.find({ idUser }).lean(),
      InstrumentModel.find({ idUser }).lean(),
      computeSummary(idUser, dateFilter ? { idUser, date: dateFilter } : { idUser }),
      InvestmentTransactionModel.find({
        idUser,
        type: "in",
        ...(dateFilter ? { date: dateFilter } : {}),
      }).lean(),
    ]);

    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

    const totalCurrentValue = instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument.investmentAccounts
          .filter((account) => !account.isDeleted)
          .reduce((accountSum, account) => accountSum + account.currentValue, 0),
      0,
    );

    const investmentInflow = investmentInflowEntries.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      wallet: { totalBalance, walletCount: wallets.length },
      investment: { totalCurrentValue, instrumentCount: instruments.length },
      monthly: {
        income: monthly.income,
        expense: monthly.expense,
        savings: monthly.income - monthly.expense,
        investmentInflow,
      },
      financialHealth: computeFinancialHealth(monthly.income, monthly.expense, investmentInflow),
    };
  },
};
