import { IAccount } from "./account.interface";
import { IAccountType } from "./accountType.interface";
import { ITransaction, TransactionWithExtra } from "./transaction.interface";

export interface ITransactionCalculation {
  id_transaction_type: number;
  name_transaction_type: string;
  amount: number;
  total_transaction: number;
}

export interface IAccountWithStats extends IAccount {
  total_amount: number;
  total_transaction: number;
  lastTransactions: ITransaction[];
  calculation: ITransactionCalculation[];
}

export interface IAccountTypeWithStats extends IAccountType {
  total_amount: number;
  percentage: number;
  total_account: number;
}

export interface IDashboardData {
  currentNetWorth: number;
  accounts: IAccountWithStats[];
  lastTransactionsGlobal: TransactionWithExtra[];
  accountTypes: IAccountTypeWithStats[];
}

export interface ILineChartData {
  date_formated: string;
  date: number;
  amount: number;
}

export type GroupByType = "day" | "month" | "year";
export type PeriodType =
  | "thisWeek"
  | "thisMonth"
  | "thisYear"
  | "last3Months"
  | "last6Months"
  | "all";

export interface IGrafikParams {
  groupBy?: GroupByType;
  id_account_type?: string;
  period?: PeriodType;
  [key: string]: any; // untuk future param lain
}
