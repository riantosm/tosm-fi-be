import mongoose from "mongoose";
import { InstrumentModel } from "../models/instrument.model";
import { InvestmentTransactionModel } from "../models/investment-transaction.model";
import { TransactionModel } from "../models/transaction.model";
// Circular import with transaction.service.ts (it imports InvestmentTransactionService
// back from here for its own cascade). Safe because every usage below happens inside
// an async function body invoked at request time, long after both modules have
// finished loading — never at module-load time.
import { removeCore as removeTransactionCore } from "./transaction.service";
import {
  ICreateMoneyInInput,
  ICreateMoneyOutInput,
  ICreateProfitLossInput,
  ICreateTransferInput,
  IInvestmentTransaction,
  ISafeInvestmentTransaction,
  IUpdateInvestmentTransactionInput,
} from "../interfaces/investment-transaction.interface";

const toSafeInvestmentTransaction = (entry: any): ISafeInvestmentTransaction => ({
  idInvestmentTransaction: entry._id.toString(),
  type: entry.type,
  date: entry.date.toISOString(),
  idInstrument: entry.idInstrument,
  idInvestmentAccount: entry.idInvestmentAccount,
  idInstrumentTo: entry.idInstrumentTo,
  idInvestmentAccountTo: entry.idInvestmentAccountTo,
  amount: entry.amount,
  investedDelta: entry.investedDelta,
  currentDelta: entry.currentDelta,
  idTransaction: entry.idTransaction,
  ...(entry.note && { note: entry.note }),
});

function assertFiniteAmount(amount: unknown, label: string): asserts amount is number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(`${label} wajib berupa angka`);
  }
}

async function findOwnedAccount(
  idUser: string,
  idInstrument: string,
  idInvestmentAccount: string,
  session?: mongoose.ClientSession
) {
  const query = InstrumentModel.findOne({ _id: idInstrument, idUser });
  const instrument = await (session ? query.session(session) : query);
  const account = instrument?.investmentAccounts.id(idInvestmentAccount);
  if (!instrument || !account) throw new Error("Akun investasi tidak ditemukan");
  return { instrument, account };
}

async function assertOwnedTransaction(idUser: string, idTransaction: string): Promise<void> {
  const exists = await TransactionModel.exists({ _id: idTransaction, idUser });
  if (!exists) throw new Error("Transaksi tidak ditemukan");
}

// Money leaving an account (withdrawal, or a transfer's source side) is
// capped by what's actually there (currentValue) — NOT by invested amount.
// A P/L-only gain (investedAmount 0, currentValue > 0) must still be
// cashable. investedAmount itself is only ever reduced down to 0, never
// negative, since it tracks contributed principal, not market value.
function computeOutgoingDelta(
  investedAmount: number,
  amount: number
): { investedDelta: number; currentDelta: number } {
  return { investedDelta: -Math.min(amount, investedAmount), currentDelta: -amount };
}

async function applyAccountDelta(
  idUser: string,
  idInstrument: string,
  idInvestmentAccount: string,
  investedDelta: number,
  currentDelta: number,
  session: mongoose.ClientSession
): Promise<void> {
  await InstrumentModel.updateOne(
    { _id: idInstrument, idUser, "investmentAccounts._id": idInvestmentAccount },
    {
      $inc: {
        "investmentAccounts.$.investedAmount": investedDelta,
        "investmentAccounts.$.currentValue": currentDelta,
      },
    },
    { session }
  );
}

// Reverses exactly what an entry applied when it was created — used only by
// delete. Editing computes a net delta instead (see updateInvestmentTransaction)
// so it never has to unwind and redo in two separate mutations.
async function reverseEntry(
  idUser: string,
  entry: IInvestmentTransaction & { _id: any },
  session: mongoose.ClientSession
): Promise<void> {
  await applyAccountDelta(
    idUser,
    entry.idInstrument,
    entry.idInvestmentAccount,
    -entry.investedDelta,
    -entry.currentDelta,
    session
  );
  if (entry.idInstrumentTo && entry.idInvestmentAccountTo) {
    await applyAccountDelta(
      idUser,
      entry.idInstrumentTo,
      entry.idInvestmentAccountTo,
      -entry.amount,
      -entry.amount,
      session
    );
  }
}

// Reverses against LIVE state before actually reversing — edits/deletes
// reverse against the account's current totals, not a true historical
// replay. If a later transaction already spent what this one contributed,
// undoing it here would drive the account negative; refuse rather than
// silently corrupt the balance. Mirrors the exact bug caught during the
// mocked version's testing.
async function assertReversalSafe(
  idUser: string,
  entry: IInvestmentTransaction & { _id: any },
  session: mongoose.ClientSession
): Promise<void> {
  const source = await findOwnedAccount(
    idUser,
    entry.idInstrument,
    entry.idInvestmentAccount,
    session
  );
  if (
    source.account.investedAmount - entry.investedDelta < 0 ||
    source.account.currentValue - entry.currentDelta < 0
  ) {
    throw new Error("Tidak bisa menghapus, transaksi lain setelahnya bergantung pada perubahan ini");
  }
  if (entry.idInstrumentTo && entry.idInvestmentAccountTo) {
    const destination = await findOwnedAccount(
      idUser,
      entry.idInstrumentTo,
      entry.idInvestmentAccountTo,
      session
    );
    if (
      destination.account.investedAmount - entry.amount < 0 ||
      destination.account.currentValue - entry.amount < 0
    ) {
      throw new Error(
        "Tidak bisa menghapus, transaksi lain setelahnya bergantung pada perubahan ini"
      );
    }
  }
}

// Reversal + delete, assuming an external session — used both by the public
// remove() (which starts its own session) and by transaction.service.ts's
// cascade delete (which needs this to run inside ITS OWN session).
async function removeInvestmentTransactionCore(
  idUser: string,
  idInvestmentTransaction: string,
  session: mongoose.ClientSession
): Promise<void> {
  const entry = await InvestmentTransactionModel.findOne({
    _id: idInvestmentTransaction,
    idUser,
  }).session(session);
  if (!entry) throw new Error("Transaksi investasi tidak ditemukan");

  await assertReversalSafe(idUser, entry, session);
  await reverseEntry(idUser, entry, session);
  await InvestmentTransactionModel.deleteOne({ _id: idInvestmentTransaction, idUser }).session(
    session
  );
}

export const InvestmentTransactionService = {
  async getList(idUser: string): Promise<ISafeInvestmentTransaction[]> {
    const entries = await InvestmentTransactionModel.find({ idUser }).sort({ date: -1 }).lean();
    return entries.map(toSafeInvestmentTransaction);
  },

  async createMoneyIn(idUser: string, input: ICreateMoneyInInput): Promise<ISafeInvestmentTransaction> {
    assertFiniteAmount(input.amount, "amount");
    if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
    await findOwnedAccount(idUser, input.idInstrument, input.idInvestmentAccount);
    await assertOwnedTransaction(idUser, input.idTransaction);

    const session = await mongoose.startSession();
    try {
      let created: any;
      await session.withTransaction(async () => {
        await applyAccountDelta(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          input.amount,
          input.amount,
          session
        );
        const [doc] = await InvestmentTransactionModel.create(
          [
            {
              idUser,
              type: "in",
              date: new Date(input.date),
              idInstrument: input.idInstrument,
              idInvestmentAccount: input.idInvestmentAccount,
              idInstrumentTo: null,
              idInvestmentAccountTo: null,
              amount: input.amount,
              investedDelta: input.amount,
              currentDelta: input.amount,
              idTransaction: input.idTransaction,
            },
          ],
          { session }
        );
        created = doc;
      });
      return toSafeInvestmentTransaction(created);
    } finally {
      await session.endSession();
    }
  },

  async createMoneyOut(
    idUser: string,
    input: ICreateMoneyOutInput
  ): Promise<ISafeInvestmentTransaction> {
    assertFiniteAmount(input.amount, "amount");
    if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
    if (input.idTransaction) await assertOwnedTransaction(idUser, input.idTransaction);

    const session = await mongoose.startSession();
    try {
      let created: any;
      await session.withTransaction(async () => {
        // Read the live balance INSIDE the session (not before starting it)
        // so the cap-check and delta computation see the same snapshot the
        // $inc below commits against — avoids a time-of-check/time-of-use
        // gap against a concurrent mutation.
        const { account } = await findOwnedAccount(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          session
        );
        if (input.amount > account.currentValue) {
          throw new Error("Jumlah penarikan melebihi saldo akun");
        }
        const { investedDelta, currentDelta } = computeOutgoingDelta(
          account.investedAmount,
          input.amount
        );

        await applyAccountDelta(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          investedDelta,
          currentDelta,
          session
        );
        const [doc] = await InvestmentTransactionModel.create(
          [
            {
              idUser,
              type: "out",
              date: new Date(input.date),
              idInstrument: input.idInstrument,
              idInvestmentAccount: input.idInvestmentAccount,
              idInstrumentTo: null,
              idInvestmentAccountTo: null,
              amount: input.amount,
              investedDelta,
              currentDelta,
              idTransaction: input.idTransaction,
              ...(input.note && { note: input.note }),
            },
          ],
          { session }
        );
        created = doc;
      });
      return toSafeInvestmentTransaction(created);
    } finally {
      await session.endSession();
    }
  },

  async createTransfer(
    idUser: string,
    input: ICreateTransferInput
  ): Promise<ISafeInvestmentTransaction> {
    assertFiniteAmount(input.amount, "amount");
    if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
    if (input.idInvestmentAccount === input.idInvestmentAccountTo) {
      throw new Error("Akun sumber dan tujuan transfer harus berbeda");
    }

    const session = await mongoose.startSession();
    try {
      let created: any;
      await session.withTransaction(async () => {
        // Same "read the live snapshot inside the session" reasoning as
        // createMoneyOut.
        const { account: source } = await findOwnedAccount(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          session
        );
        await findOwnedAccount(idUser, input.idInstrumentTo, input.idInvestmentAccountTo, session);
        if (input.amount > source.currentValue) {
          throw new Error("Jumlah transfer melebihi saldo akun sumber");
        }
        const { investedDelta, currentDelta } = computeOutgoingDelta(
          source.investedAmount,
          input.amount
        );

        await applyAccountDelta(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          investedDelta,
          currentDelta,
          session
        );
        await applyAccountDelta(
          idUser,
          input.idInstrumentTo,
          input.idInvestmentAccountTo,
          input.amount,
          input.amount,
          session
        );
        const [doc] = await InvestmentTransactionModel.create(
          [
            {
              idUser,
              type: "transfer",
              date: new Date(input.date),
              idInstrument: input.idInstrument,
              idInvestmentAccount: input.idInvestmentAccount,
              idInstrumentTo: input.idInstrumentTo,
              idInvestmentAccountTo: input.idInvestmentAccountTo,
              amount: input.amount,
              investedDelta,
              currentDelta,
              idTransaction: null,
            },
          ],
          { session }
        );
        created = doc;
      });
      return toSafeInvestmentTransaction(created);
    } finally {
      await session.endSession();
    }
  },

  async createProfitLoss(
    idUser: string,
    input: ICreateProfitLossInput
  ): Promise<ISafeInvestmentTransaction> {
    assertFiniteAmount(input.newCurrentValue, "newCurrentValue");
    if (input.newCurrentValue < 0) throw new Error("Nilai saat ini tidak boleh negatif");

    const session = await mongoose.startSession();
    try {
      let created: any;
      await session.withTransaction(async () => {
        const { account } = await findOwnedAccount(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          session
        );
        if (input.newCurrentValue === account.currentValue) {
          throw new Error("Nilai saat ini tidak berubah");
        }
        const delta = input.newCurrentValue - account.currentValue;

        await applyAccountDelta(
          idUser,
          input.idInstrument,
          input.idInvestmentAccount,
          0,
          delta,
          session
        );
        const [doc] = await InvestmentTransactionModel.create(
          [
            {
              idUser,
              type: "pl",
              date: new Date(input.date),
              idInstrument: input.idInstrument,
              idInvestmentAccount: input.idInvestmentAccount,
              idInstrumentTo: null,
              idInvestmentAccountTo: null,
              amount: delta,
              investedDelta: 0,
              currentDelta: delta,
              idTransaction: null,
            },
          ],
          { session }
        );
        created = doc;
      });
      return toSafeInvestmentTransaction(created);
    } finally {
      await session.endSession();
    }
  },

  // Edits amount/date only. Computes the NET delta between the old and new
  // applied effect and applies that single net change — cheaper and more
  // obviously correct than physically reversing then reapplying two mutations.
  async update(
    idUser: string,
    idInvestmentTransaction: string,
    input: IUpdateInvestmentTransactionInput
  ): Promise<ISafeInvestmentTransaction> {
    assertFiniteAmount(input.amount, "amount");

    const session = await mongoose.startSession();
    try {
      let updated: any;
      await session.withTransaction(async () => {
        const existing = await InvestmentTransactionModel.findOne({
          _id: idInvestmentTransaction,
          idUser,
        }).session(session);
        if (!existing) throw new Error("Transaksi investasi tidak ditemukan");

        const { account } = await findOwnedAccount(
          idUser,
          existing.idInstrument,
          existing.idInvestmentAccount,
          session
        );
        // "Clean" values as if this entry had never been applied — used to
        // validate/cap the edited amount against the state the entry
        // actually started from, not the version already including its own
        // old effect.
        const cleanInvested = account.investedAmount - existing.investedDelta;
        const cleanCurrent = account.currentValue - existing.currentDelta;

        let investedDelta: number;
        let currentDelta: number;
        if (existing.type === "in") {
          if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
          investedDelta = input.amount;
          currentDelta = input.amount;
        } else if (existing.type === "pl") {
          investedDelta = 0;
          currentDelta = input.amount;
        } else {
          if (input.amount <= 0) throw new Error("amount harus lebih besar dari 0");
          if (input.amount > cleanCurrent) {
            throw new Error(
              existing.type === "transfer"
                ? "Jumlah transfer melebihi saldo akun sumber"
                : "Jumlah penarikan melebihi saldo akun"
            );
          }
          ({ investedDelta, currentDelta } = computeOutgoingDelta(cleanInvested, input.amount));
        }

        // Same "can't undo something a later transaction already relied on"
        // guard as delete — check the NET change against the account's
        // current (not clean) totals before committing anything.
        if (
          account.investedAmount - existing.investedDelta + investedDelta < 0 ||
          account.currentValue - existing.currentDelta + currentDelta < 0
        ) {
          throw new Error(
            "Tidak bisa diperbarui, transaksi lain setelahnya bergantung pada perubahan ini"
          );
        }

        await applyAccountDelta(
          idUser,
          existing.idInstrument,
          existing.idInvestmentAccount,
          investedDelta - existing.investedDelta,
          currentDelta - existing.currentDelta,
          session
        );

        if (existing.idInstrumentTo && existing.idInvestmentAccountTo) {
          const destination = await findOwnedAccount(
            idUser,
            existing.idInstrumentTo,
            existing.idInvestmentAccountTo,
            session
          );
          const amountDelta = input.amount - existing.amount;
          if (
            destination.account.investedAmount + amountDelta < 0 ||
            destination.account.currentValue + amountDelta < 0
          ) {
            throw new Error(
              "Tidak bisa diperbarui, transaksi lain setelahnya bergantung pada perubahan ini"
            );
          }
          await applyAccountDelta(
            idUser,
            existing.idInstrumentTo,
            existing.idInvestmentAccountTo,
            amountDelta,
            amountDelta,
            session
          );
        }

        existing.amount = input.amount;
        existing.date = new Date(input.date);
        existing.investedDelta = investedDelta;
        existing.currentDelta = currentDelta;
        if (input.note !== undefined) {
          existing.note = input.note;
        }
        await existing.save({ session });
        updated = existing;
      });
      return toSafeInvestmentTransaction(updated);
    } finally {
      await session.endSession();
    }
  },

  async remove(idUser: string, idInvestmentTransaction: string): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const entry = await InvestmentTransactionModel.findOne({
          _id: idInvestmentTransaction,
          idUser,
        }).session(session);
        if (!entry) throw new Error("Transaksi investasi tidak ditemukan");

        await removeInvestmentTransactionCore(idUser, idInvestmentTransaction, session);

        if (entry.idTransaction) {
          await removeTransactionCore(idUser, entry.idTransaction, session);
        }
      });
    } finally {
      await session.endSession();
    }
  },

  // Cascade entry point called FROM transaction.service.ts's remove() — finds
  // the ledger row linked to a wallet transaction being deleted, no-ops if
  // none, else reverses it under the CALLER's session. Never calls back into
  // TransactionService — the caller is already deleting that transaction.
  async removeByLinkedTransactionId(
    idUser: string,
    idTransaction: string,
    session: mongoose.ClientSession
  ): Promise<void> {
    const entry = await InvestmentTransactionModel.findOne({ idUser, idTransaction }).session(
      session
    );
    if (!entry) return;
    await removeInvestmentTransactionCore(idUser, entry._id.toString(), session);
  },
};
