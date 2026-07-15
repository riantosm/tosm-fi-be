import { Types } from "mongoose";

export interface IInvestmentAccount {
  nameInvestmentAccount: string;
  investedAmount: number;
  currentValue: number;
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
}

export interface ISafeInstrument {
  idInstrument: string;
  nameInstrument: string;
  color: string;
  investmentAccounts: ISafeInvestmentAccount[];
}
