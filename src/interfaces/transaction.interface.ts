export type TransactionType = "income" | "expense" | "transfer" | "correction";

export interface ITransaction {
  idUser: string;
  type: TransactionType;
  idWallet: string | null;
  idCategory: string | null;
  idSubCategory: string | null;
  idWalletFrom: string | null;
  idWalletTo: string | null;
  title: string;
  notes: string;
  amount: number;
  date: Date;
}

export interface ICreateTransactionInput {
  type: TransactionType;
  idWallet?: string | null;
  idCategory?: string | null;
  idSubCategory?: string | null;
  idWalletFrom?: string | null;
  idWalletTo?: string | null;
  title: string;
  notes?: string;
  amount: number;
  date: string;
}

export type IUpdateTransactionInput = ICreateTransactionInput;

export interface ISafeTransaction {
  idTransaction: string;
  type: TransactionType;
  idWallet: string | null;
  idCategory: string | null;
  idSubCategory: string | null;
  idWalletFrom: string | null;
  idWalletTo: string | null;
  title: string;
  notes: string;
  amount: number;
  date: string;
}

export type TransactionSortOption = "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc";

export interface ITransactionListQuery {
  /** "YYYY-MM" */
  month?: string;
  type?: TransactionType;
  idWallet?: string;
  idCategory?: string;
  idSubCategory?: string;
  /** "YYYY-MM-DD" */
  dateFrom?: string;
  /** "YYYY-MM-DD" */
  dateTo?: string;
  search?: string;
  sort?: TransactionSortOption;
  page?: number;
  limit?: number;
}

export interface ITransactionSubCategoryBreakdownItem {
  idSubCategory: string | null;
  nameSubCategory: string | null;
  icon: string | null;
  amount: number;
  transactionCount: number;
  /** Percentage of the parent category's total. */
  percentage: number;
}

export interface ITransactionCategoryBreakdownItem {
  idCategory: string;
  nameCategory: string;
  color: string;
  icon: string;
  amount: number;
  transactionCount: number;
  /** Percentage of total expense. */
  percentage: number;
  subCategoryBreakdown: ITransactionSubCategoryBreakdownItem[];
}

export interface ITransactionSummary {
  income: number;
  expense: number;
  net: number;
  /** Expense-only, sorted descending by amount. */
  categoryBreakdown: ITransactionCategoryBreakdownItem[];
}

export interface ITransactionListResult {
  transactions: ISafeTransaction[];
  total: number | null;
  page: number | null;
  limit: number | null;
  totalPages: number | null;
  summary: ITransactionSummary;
}
