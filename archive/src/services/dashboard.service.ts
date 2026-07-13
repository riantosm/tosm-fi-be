import moment from "moment";
import {
  IAccountWithStats,
  IDashboardData,
  IGrafikParams,
  ILineChartData,
} from "../interfaces/dashboard.interface";
import { AccountModel } from "../models/account.model";
import { AccountTypeModel } from "../models/accountType.model";
import { TransactionTypeModel } from "../models/transactionType.model";
import { formatTimestamp } from "../utils/formatTimestamp";
import { TransactionService } from "./transaction.service";

const MAX_TRANSACTION = 5;
const MAX_TRANSACTION_GLOBAL = 10;
const MAX_LAST_BALANCE_GLOBAL = 10;

export const DashboardService = {
  async getDashboard(query?: {
    groupBy?: "day" | "month" | "year";
    id_account_type?: string;
  }): Promise<IDashboardData> {
    const groupBy = query?.groupBy || "day";
    const idAccountTypeParam = query?.id_account_type;

    const [accounts, allTransactions, transactionTypes, accountTypes] =
      await Promise.all([
        AccountModel.find().lean(),
        TransactionService.getAll(),
        TransactionTypeModel.find().lean(),
        AccountTypeModel.find().lean(),
      ]);

    let filteredAccounts = accounts;
    if (idAccountTypeParam) {
      const accountTypeIds = decodeURIComponent(idAccountTypeParam)
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean);
      filteredAccounts = accounts.filter((a) =>
        accountTypeIds.includes(a.id_account_type)
      );
    }

    const accountTotals: IAccountWithStats[] = filteredAccounts.map((acc) => {
      const accTransactions = allTransactions.data.filter(
        (t) => t.id_account === acc.id_account
      );

      const total = accTransactions.reduce(
        (sum, t) => sum + (t?.amount || 0),
        0
      );
      const lastTransactions = accTransactions
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .slice(0, MAX_TRANSACTION);

      const total_transaction = accTransactions.length;

      const accountType = accountTypes.find(
        (type) => type.id_account_type === acc.id_account_type
      );

      const calculation = transactionTypes.map((tt) => {
        const trxOfType = accTransactions.filter(
          (t) => t.id_transaction_type === tt.id_transaction_type
        );
        return {
          id_transaction_type: tt.id_transaction_type,
          name_transaction_type: tt.name_transaction_type,
          amount: trxOfType.reduce((sum, t) => sum + (t?.amount || 0), 0),
          total_transaction: trxOfType.length,
        };
      });

      // --- Tetap pakai groupBy (original logic)
      const grouped: Record<string, number> = {};
      accTransactions.forEach((t) => {
        const d = new Date((t.date || 0) * 1000);
        let key = "";
        switch (groupBy) {
          case "year":
            key = d.getFullYear().toString();
            break;
          case "month":
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              "0"
            )}`;
            break;
          default:
            key = d.toISOString().slice(0, 10);
        }
        grouped[key] = (grouped[key] || 0) + (t.amount || 0);
      });

      const sortedKeys = Object.keys(grouped).sort();
      let cumulative = 0;
      const balanceAsc = sortedKeys.map((key) => {
        cumulative += grouped[key];
        const d =
          groupBy === "year"
            ? new Date(`${key}-01-01`)
            : groupBy === "month"
            ? new Date(`${key}-01`)
            : new Date(key);
        const timestamp = Math.floor(d.getTime() / 1000);
        return {
          date_formated: formatTimestamp(timestamp),
          date: timestamp,
          amount: cumulative,
        };
      });

      // ✅ Buat ulang lastBalance dengan groupBy DAY khusus
      const groupedDaily: Record<string, number> = {};
      accTransactions.forEach((t) => {
        const d = new Date((t.date || 0) * 1000);
        const key = d.toISOString().slice(0, 10); // selalu per hari
        groupedDaily[key] = (groupedDaily[key] || 0) + (t.amount || 0);
      });

      const sortedKeysDaily = Object.keys(groupedDaily).sort();
      let cumulativeDaily = 0;
      const balanceAscDaily = sortedKeysDaily.map((key) => {
        cumulativeDaily += groupedDaily[key];
        const d = new Date(key);
        const timestamp = Math.floor(d.getTime() / 1000);
        return {
          date_formated: formatTimestamp(timestamp),
          date: timestamp,
          amount: cumulativeDaily,
        };
      });

      if (balanceAscDaily.length < MAX_LAST_BALANCE_GLOBAL) {
        const missingCount = MAX_LAST_BALANCE_GLOBAL - balanceAscDaily.length;
        const firstDate = balanceAscDaily[0]
          ? moment(balanceAscDaily[0].date * 1000)
          : moment();
        const dummyData = Array.from({ length: missingCount }).map((_, i) => {
          const dummyDate = firstDate
            .clone()
            .subtract(missingCount - i, "days");
          return {
            date_formated: dummyDate.locale("en").format("DD MMMM YYYY"),
            date: Math.floor(dummyDate.valueOf() / 1000),
            amount: 0,
          };
        });
        balanceAscDaily.unshift(...dummyData);
      }

      const lastBalance = balanceAscDaily
        .reverse()
        .slice(0, MAX_LAST_BALANCE_GLOBAL);

      return {
        ...acc,
        name_account_type: accountType?.name_account_type || "Unknown",
        color: accountType?.color,
        total_amount: total,
        lastTransactions,
        total_transaction,
        calculation,
        lastBalance, // ✅ now daily
      };
    }) as IAccountWithStats[];

    const currentNetWorth = accountTotals.reduce(
      (sum, acc) => sum + acc.total_amount,
      0
    );

    const accountTypesWithStats = accountTypes
      .map((at) => {
        const relatedAccounts = accountTotals.filter(
          (acc) => acc.id_account_type === at.id_account_type
        );

        const relatedTransactions = relatedAccounts
          .flatMap((acc) => acc.lastTransactions)
          .sort((a, b) => b.date - a.date)
          .slice(0, MAX_TRANSACTION);

        const totalAmount = relatedAccounts.reduce(
          (sum, acc) => sum + acc.total_amount,
          0
        );

        const allTrx = allTransactions.data.filter((t) =>
          relatedAccounts.some((a) => a.id_account === t.id_account)
        );

        // --- Tetap pakai groupBy utama
        const grouped: Record<string, number> = {};
        allTrx.forEach((t) => {
          const d = new Date((t.date || 0) * 1000);
          let key = "";
          switch (groupBy) {
            case "year":
              key = d.getFullYear().toString();
              break;
            case "month":
              key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                2,
                "0"
              )}`;
              break;
            default:
              key = d.toISOString().slice(0, 10);
          }
          grouped[key] = (grouped[key] || 0) + (t.amount || 0);
        });

        const sortedKeys = Object.keys(grouped).sort();
        let cumulative = 0;
        const balanceAsc = sortedKeys.map((key) => {
          cumulative += grouped[key];
          const d =
            groupBy === "year"
              ? new Date(`${key}-01-01`)
              : groupBy === "month"
              ? new Date(`${key}-01`)
              : new Date(key);
          const timestamp = Math.floor(d.getTime() / 1000);
          return {
            date_formated: formatTimestamp(timestamp),
            date: timestamp,
            amount: cumulative,
          };
        });

        // ✅ Buat ulang lastBalance per hari (DAY)
        const groupedDaily: Record<string, number> = {};
        allTrx.forEach((t) => {
          const d = new Date((t.date || 0) * 1000);
          const key = d.toISOString().slice(0, 10);
          groupedDaily[key] = (groupedDaily[key] || 0) + (t.amount || 0);
        });

        const sortedKeysDaily = Object.keys(groupedDaily).sort();
        let cumulativeDaily = 0;
        const balanceAscDaily = sortedKeysDaily.map((key) => {
          cumulativeDaily += groupedDaily[key];
          const d = new Date(key);
          const timestamp = Math.floor(d.getTime() / 1000);
          return {
            date_formated: formatTimestamp(timestamp),
            date: timestamp,
            amount: cumulativeDaily,
          };
        });

        if (balanceAscDaily.length < MAX_LAST_BALANCE_GLOBAL) {
          const missingCount = MAX_LAST_BALANCE_GLOBAL - balanceAscDaily.length;
          const firstDate = balanceAscDaily[0]
            ? moment(balanceAscDaily[0].date * 1000)
            : moment();
          const dummyData = Array.from({ length: missingCount }).map((_, i) => {
            const dummyDate = firstDate
              .clone()
              .subtract(missingCount - i, "days");
            return {
              date_formated: dummyDate.locale("en").format("DD MMMM YYYY"),
              date: Math.floor(dummyDate.valueOf() / 1000),
              amount: 0,
            };
          });
          balanceAscDaily.unshift(...dummyData);
        }

        const lastBalance = balanceAscDaily
          .reverse()
          .slice(0, MAX_LAST_BALANCE_GLOBAL);

        const percentage =
          currentNetWorth > 0
            ? parseFloat(((totalAmount / currentNetWorth) * 100).toFixed(2))
            : 0;

        return {
          ...at,
          total_amount: totalAmount,
          percentage,
          lastTransactions: relatedTransactions,
          lastBalance,
          total_account: relatedAccounts.length,
        };
      })
      // ✅ Urutkan berdasarkan total_amount terbesar di atas
      .sort((a, b) => b.total_amount - a.total_amount)
      .filter((data) =>
        idAccountTypeParam
          ? idAccountTypeParam?.includes(String(data.id_account_type))
          : true
      );

    const lastTransactionsGlobal = allTransactions.data
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, MAX_TRANSACTION_GLOBAL);

    return {
      currentNetWorth,
      accounts: accountTotals,
      accountTypes: accountTypesWithStats,
      lastTransactionsGlobal,
    };
  },
  async getLineChart(params: IGrafikParams): Promise<ILineChartData[]> {
    const { groupBy = "day", id_account_type, period } = params;

    const transactions = await TransactionService.getAll();
    const accounts = await AccountModel.find().lean();

    let accountIds: number[] = [];
    if (id_account_type) {
      const decoded = decodeURIComponent(id_account_type);
      const typeIds = decoded
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean);

      accountIds = accounts
        .filter((a) => typeIds.includes(a.id_account_type))
        .map((a) => a.id_account);
    }

    const filteredTransactions = accountIds.length
      ? transactions.data.filter((t) => accountIds.includes(t.id_account || 0))
      : transactions.data;

    if (!filteredTransactions.length) return [];

    const now = new Date();
    let fromDate: Date | null = null;

    switch (period) {
      case "thisWeek": {
        const firstDay = new Date(now);
        firstDay.setDate(now.getDate() - now.getDay());
        fromDate = firstDay;
        break;
      }
      case "thisMonth": {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case "thisYear": {
        fromDate = new Date(now.getFullYear(), 0, 1);
        break;
      }
      case "last3Months": {
        fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      }
      case "last6Months": {
        fromDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      }
      case "all":
        fromDate = null; // ✅ tampilkan semua data
        break;
    }

    const grouped: Record<string, number> = {};
    for (const t of filteredTransactions) {
      const d = new Date((t.date || 0) * 1000);
      const key =
        groupBy === "year"
          ? d.getFullYear().toString()
          : groupBy === "month"
          ? d.toISOString().slice(0, 7)
          : d.toISOString().slice(0, 10);

      grouped[key] = (grouped[key] || 0) + (t.amount || 0);
    }

    const sortedKeys = Object.keys(grouped).sort();
    if (!sortedKeys.length) return [];

    let cumulative = 0;
    const allData: ILineChartData[] = sortedKeys.map((key) => {
      cumulative += grouped[key];
      const date = new Date(key + (groupBy === "day" ? "" : "-01"));
      return {
        date_formated: formatTimestamp(date.getTime() / 1000),
        date: Math.floor(date.getTime() / 1000),
        amount: cumulative,
      };
    });

    let filteredData = allData;
    if (fromDate) {
      const fromTimestamp = Math.floor(fromDate.getTime() / 1000);
      filteredData = allData.filter((d) => d.date >= fromTimestamp);
    }

    if (!filteredData.length && allData.length > 0) {
      filteredData = [allData[allData.length - 1]];
    }

    return filteredData.sort((a, b) => b.date - a.date);
  },
  async getComparedLineChart(params: { id_account_type?: string }) {
    const idAccountTypeList = params?.id_account_type
      ?.split(",")
      .map((v) => Number(v))
      .filter(Boolean);

    const [accounts, allTransactions] = await Promise.all([
      AccountModel.find().lean(),
      TransactionService.getAll(),
    ]);

    const accountMap = new Map();
    accounts.forEach((acc: any) => {
      accountMap.set(acc.id_account, acc.id_account_type);
    });

    // ✅ transaksi + tambahkan id_account_type via lookup
    const tx = allTransactions.data.map((trx) => ({
      ...trx,
      id_account_type: accountMap.get(trx.id_account),
    }));

    // ✅ filter jika ada id_account_type
    const filtered = idAccountTypeList
      ? tx.filter((i) =>
          params?.id_account_type
            ? idAccountTypeList.includes(i.id_account_type)
            : true
        )
      : tx;

    // ✅ group by id_account_type
    const grouped = new Map<number, any[]>();
    filtered.forEach((trx) => {
      if (!grouped.has(trx.id_account_type))
        grouped.set(trx.id_account_type, []);
      grouped.get(trx.id_account_type)!.push(trx);
    });

    const result: any[] = [];

    for (const [id_account_type, trxList] of grouped.entries()) {
      // ✅ transaction (level account_type)
      const typeTransaction = buildTransaction(trxList);

      // ✅ ambil accounts yg belong pada account_type ini
      const accountsInType = accounts.filter(
        (acc) => acc.id_account_type === id_account_type
      );

      // ✅ per-account
      const accountDetails = accountsInType.map((acc) => {
        const trxAcc = trxList.filter(
          (trx) => trx.id_account === acc.id_account
        );

        return {
          id_account: acc.id_account,
          transaction: buildTransaction(trxAcc),
        };
      });

      result.push({
        id_account_type,
        transaction: typeTransaction,
        account: accountDetails,
      });
    }

    return result;
  },
};

function buildTransaction(trxList: any[]) {
  /** 1) Group by formatted date (x) */
  const dateMap = new Map<
    string,
    { all: number; in: number; timestamp: number }
  >();

  trxList.forEach((trx) => {
    const timestamp = trx.date;
    const x = moment(timestamp * 1000).format("D MMMM YYYY");
    const isProfit = trx.id_transaction_type === 3;

    const prev = dateMap.get(x) || { all: 0, in: 0, timestamp };

    prev.all += trx.amount;
    if (!isProfit) prev.in += trx.amount;

    dateMap.set(x, prev);
  });

  /** 2) SORT by timestamp ASC */
  const sorted = [...dateMap.values()].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  /** 3) Build cumulative */
  let cumulativeAll = 0;
  let cumulativeIn = 0;

  const lineAll: any[] = [];
  const lineIn: any[] = [];

  sorted.forEach((row) => {
    const x = moment(row.timestamp * 1000).format("D MMMM YYYY");

    cumulativeAll += row.all;
    cumulativeIn += row.in;
    if (cumulativeIn < 0) cumulativeIn = 0;

    lineAll.push({ x, y: cumulativeAll });
    lineIn.push({ x, y: cumulativeIn });
  });

  return {
    in: lineIn,
    all: lineAll,
  };
}
