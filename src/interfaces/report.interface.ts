import { ITransactionCategoryBreakdownItem } from "./transaction.interface";

export interface IReportMetricDelta {
  value: number;
  changePercent: number;
}

export interface IReportSummary {
  totalIncome: IReportMetricDelta;
  totalExpense: IReportMetricDelta;
  netCashFlow: IReportMetricDelta;
  transactionCount: IReportMetricDelta;
  /** Expense-only, sorted descending by amount — same shape `GET /transactions` already returns. */
  categoryBreakdown: ITransactionCategoryBreakdownItem[];
}

export interface IWalletUsageItem {
  idWallet: string;
  nameWallet: string;
  color: string;
  transactionCount: number;
  percentage: number;
}

export interface ITopSpendingItem {
  idTransaction: string;
  rank: number;
  title: string;
  categoryName: string;
  subCategoryName: string | null;
  amount: number;
  date: string;
}

export interface ICashFlowPoint {
  label: string;
  income: number;
  expense: number;
  isToday: boolean;
}

export interface IMonthlyTrendPoint {
  label: string;
  income: number;
  expense: number;
}
