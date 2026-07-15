import { Types } from "mongoose";

export interface IInvestmentAccount {
  nameInvestmentAccount: string;
  investedAmount: number;
  currentValue: number;
  // Soft-deleted rather than actually removed from the embedded array once it
  // has any linked investment-transaction ledger entries — those entries keep
  // referencing this subdocument's _id for its name, so it must stay
  // resolvable. Hidden from the active account list/picker UI; a delete is
  // only ever allowed once currentValue is back to 0 (see
  // InstrumentService.removeInvestmentAccount).
  isDeleted: boolean;
}

export interface IInstrument {
  idUser: string;
  nameInstrument: string;
  color: string;
  // Typed as Mongoose's DocumentArray (not a plain array) so `.id()`/`.push()`
  // are available on hydrated documents — same reasoning as
  // ICategory.subCategories.
  investmentAccounts: Types.DocumentArray<IInvestmentAccount>;
}

export interface ICreateInstrumentInput {
  nameInstrument: string;
  color: string;
}

export interface IUpdateInstrumentInput {
  nameInstrument: string;
  color: string;
}

export interface ICreateInvestmentAccountInput {
  nameInvestmentAccount: string;
}

export interface IUpdateInvestmentAccountInput {
  nameInvestmentAccount: string;
}

export interface ISafeInvestmentAccount {
  idInvestmentAccount: string;
  idInstrument: string;
  nameInvestmentAccount: string;
  investedAmount: number;
  currentValue: number;
  isDeleted: boolean;
}

export interface ISafeInstrument {
  idInstrument: string;
  nameInstrument: string;
  color: string;
  investmentAccounts: ISafeInvestmentAccount[];
}
