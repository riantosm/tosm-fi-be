export interface ITransaction {
  id_transaction: number;
  id_account: number;
  amount: number;
  id_transaction_type: number;
  description_transaction: string;
  date: number;
}

export interface TransactionWithExtra extends Partial<ITransaction> {
  name_account?: string;
  name_transaction_type?: string;
  date_formated?: string;
}

export interface ITransferInput {
  from_id_account: number;
  to_id_account: number;
  amount: number;
  date: number;
}

export interface IProfitInput {
  id_account: number;
  amount: number;
  date: number;
}

export interface TransactionFilter {
  page?: number;
  limit?: number;
  id_account?: number;
  id_transaction_type?: number;
  search?: string;
  start_date?: number;
  end_date?: number;
  sort_by?: "date" | "amount";
  sort_order?: "asc" | "desc";
}
