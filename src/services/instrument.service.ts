import {
  ICreateInstrumentInput,
  ICreateInvestmentAccountInput,
  ISafeInstrument,
  ISafeInvestmentAccount,
  IUpdateInstrumentInput,
  IUpdateInvestmentAccountInput,
} from "../interfaces/instrument.interface";
import { InstrumentModel } from "../models/instrument.model";

const toSafeInvestmentAccount = (idInstrument: string, account: any): ISafeInvestmentAccount => ({
  idInvestmentAccount: account._id.toString(),
  idInstrument,
  nameInvestmentAccount: account.nameInvestmentAccount,
  investedAmount: account.investedAmount,
  currentValue: account.currentValue,
  isDeleted: account.isDeleted ?? false,
});

const toSafeInstrument = (instrument: any): ISafeInstrument => {
  const idInstrument = instrument._id.toString();
  return {
    idInstrument,
    nameInstrument: instrument.nameInstrument,
    color: instrument.color,
    investmentAccounts: [...instrument.investmentAccounts].map((account) =>
      toSafeInvestmentAccount(idInstrument, account)
    ),
  };
};

async function findOwnedInstrument(idUser: string, idInstrument: string) {
  const instrument = await InstrumentModel.findOne({ _id: idInstrument, idUser });
  if (!instrument) throw new Error("Instrumen tidak ditemukan");
  return instrument;
}

export const InstrumentService = {
  async getList(idUser: string): Promise<ISafeInstrument[]> {
    const instruments = await InstrumentModel.find({ idUser }).sort({ createdAt: 1 }).lean();
    return instruments.map(toSafeInstrument);
  },

  async create(idUser: string, input: ICreateInstrumentInput): Promise<ISafeInstrument> {
    const instrument = await InstrumentModel.create({
      idUser,
      nameInstrument: input.nameInstrument,
      color: input.color,
    });
    return toSafeInstrument(instrument);
  },

  async update(
    idUser: string,
    idInstrument: string,
    input: IUpdateInstrumentInput
  ): Promise<ISafeInstrument> {
    const instrument = await findOwnedInstrument(idUser, idInstrument);
    instrument.nameInstrument = input.nameInstrument;
    instrument.color = input.color;
    await instrument.save();
    return toSafeInstrument(instrument);
  },

  async remove(idUser: string, idInstrument: string): Promise<void> {
    const instrument = await InstrumentModel.findOneAndDelete({ _id: idInstrument, idUser });
    if (!instrument) throw new Error("Instrumen tidak ditemukan");
  },

  async createInvestmentAccount(
    idUser: string,
    idInstrument: string,
    input: ICreateInvestmentAccountInput
  ): Promise<ISafeInvestmentAccount> {
    const instrument = await findOwnedInstrument(idUser, idInstrument);
    instrument.investmentAccounts.push({
      nameInvestmentAccount: input.nameInvestmentAccount,
      investedAmount: 0,
      currentValue: 0,
    });
    await instrument.save();
    const created = instrument.investmentAccounts[instrument.investmentAccounts.length - 1];
    return toSafeInvestmentAccount(idInstrument, created);
  },

  async updateInvestmentAccount(
    idUser: string,
    idInstrument: string,
    idInvestmentAccount: string,
    input: IUpdateInvestmentAccountInput
  ): Promise<ISafeInvestmentAccount> {
    const instrument = await findOwnedInstrument(idUser, idInstrument);
    const account = instrument.investmentAccounts.id(idInvestmentAccount);
    if (!account) throw new Error("Akun investasi tidak ditemukan");

    account.nameInvestmentAccount = input.nameInvestmentAccount;
    await instrument.save();
    return toSafeInvestmentAccount(idInstrument, account);
  },

  async removeInvestmentAccount(
    idUser: string,
    idInstrument: string,
    idInvestmentAccount: string
  ): Promise<void> {
    const instrument = await findOwnedInstrument(idUser, idInstrument);
    const account = instrument.investmentAccounts.id(idInvestmentAccount);
    if (!account) throw new Error("Akun investasi tidak ditemukan");
    if (account.currentValue !== 0) {
      throw new Error(
        "Akun ini masih memiliki nilai saat ini — pindahkan dana ke akun lain terlebih dahulu sebelum menghapus"
      );
    }

    // Soft delete instead of actually removing the subdocument: any
    // investment-transaction ledger entry already referencing this account's
    // id needs its name to stay resolvable (shown with a "(deleted)" suffix
    // on the frontend) instead of falling back to a blank/"-" label.
    account.isDeleted = true;
    await instrument.save();
  },
};
