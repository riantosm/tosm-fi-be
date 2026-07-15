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
