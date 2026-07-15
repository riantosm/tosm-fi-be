export type InvestmentTransactionType = "in" | "out" | "transfer" | "pl";

export interface IInvestmentTransaction {
  idUser: string;
  type: InvestmentTransactionType;
  date: Date;
  idInstrument: string;
  idInvestmentAccount: string;
  idInstrumentTo: string | null;
  idInvestmentAccountTo: string | null;
  // Display magnitude: in/out/transfer = positive amount moved; pl = signed delta.
  amount: number;
  // The actual signed delta applied to idInvestmentAccount's
  // investedAmount/currentValue at creation/edit time — see
  // computeOutgoingDelta in investment-transaction.service.ts. Stored
  // explicitly so edits/deletes can reverse this entry exactly.
  investedDelta: number;
  currentDelta: number;
  idTransaction: string | null;
  note?: string;
}

export interface ISafeInvestmentTransaction {
  idInvestmentTransaction: string;
  type: InvestmentTransactionType;
  date: string;
  idInstrument: string;
  idInvestmentAccount: string;
  idInstrumentTo: string | null;
  idInvestmentAccountTo: string | null;
  amount: number;
  investedDelta: number;
  currentDelta: number;
  idTransaction: string | null;
  note?: string;
}

export interface ICreateMoneyInInput {
  idInstrument: string;
  idInvestmentAccount: string;
  amount: number;
  date: string;
  idTransaction: string;
}

export interface ICreateMoneyOutInput {
  idInstrument: string;
  idInvestmentAccount: string;
  amount: number;
  date: string;
  idTransaction: string | null;
  note?: string;
}

export interface ICreateTransferInput {
  idInstrument: string;
  idInvestmentAccount: string;
  idInstrumentTo: string;
  idInvestmentAccountTo: string;
  amount: number;
  date: string;
}

export interface ICreateProfitLossInput {
  idInstrument: string;
  idInvestmentAccount: string;
  newCurrentValue: number;
  date: string;
}

export interface IUpdateInvestmentTransactionInput {
  amount: number;
  date: string;
  note?: string;
}

export type InvestmentTransactionSortOption = "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc";

export interface IInvestmentTransactionListQuery {
  /** Matches idInstrument OR idInstrumentTo (source or transfer destination). */
  idInstrument?: string;
  /** Matches idInvestmentAccount OR idInvestmentAccountTo (source or transfer destination). */
  idInvestmentAccount?: string;
  type?: InvestmentTransactionType;
  /** "YYYY-MM-DD" */
  dateFrom?: string;
  /** "YYYY-MM-DD" */
  dateTo?: string;
  /** Matches note, or the resolved instrument/account name. */
  search?: string;
  sort?: InvestmentTransactionSortOption;
  page?: number;
  limit?: number;
}

export interface IInvestmentTransactionListResult {
  investmentTransactions: ISafeInvestmentTransaction[];
  total: number | null;
  page: number | null;
  limit: number | null;
  totalPages: number | null;
}

export type NetWorthTimelineGranularity = "day" | "month" | "year";

export interface INetWorthTimelineQuery {
  granularity: NetWorthTimelineGranularity;
  /** "YYYY-MM-DD" */
  dateFrom: string;
  /** "YYYY-MM-DD" */
  dateTo: string;
  /** Optional subset of instrument ids to scope the timeline to; omit for the whole portfolio. */
  idInstrument?: string[];
  locale: string;
}

export interface INetWorthTimelinePoint {
  label: string;
  /** ISO date at the bucket's end — the point this snapshot is "as of". */
  date: string;
  invested: number;
  current: number;
}

export interface ITimelinePoint {
  /** ISO date of the ledger entry that produced this point (not bucketed). */
  date: string;
  /** Running total as of this point. */
  invested: number;
  current: number;
}

export interface IInvestmentTimelinesResult {
  /** Keyed by idInvestmentAccount. */
  accounts: Record<string, ITimelinePoint[]>;
  /** Keyed by idInstrument. */
  instruments: Record<string, ITimelinePoint[]>;
}
