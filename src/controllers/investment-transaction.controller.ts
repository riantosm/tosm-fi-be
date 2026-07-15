import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { InvestmentTransactionService } from "../services/investment-transaction.service";
import { responseHandler } from "../utils/responseHandler";

export const InvestmentTransactionController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const entries = await InvestmentTransactionService.getList(req.currentUser!.idUser);
      return responseHandler(res, {
        message: "Berhasil mengambil daftar transaksi investasi",
        data: entries,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Gagal mengambil daftar transaksi investasi",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async createMoneyIn(req: AuthRequest, res: Response) {
    try {
      const { idInstrument, idInvestmentAccount, amount, date, idTransaction } = req.body;

      if (!idInstrument || !idInvestmentAccount || amount === undefined || amount === null || !date || !idTransaction) {
        return responseHandler(res, {
          message: "idInstrument, idInvestmentAccount, amount, date, dan idTransaction wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const entry = await InvestmentTransactionService.createMoneyIn(req.currentUser!.idUser, {
        idInstrument,
        idInvestmentAccount,
        amount,
        date,
        idTransaction,
      });

      return responseHandler(res, {
        message: "Uang masuk investasi berhasil dicatat",
        data: entry,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mencatat uang masuk investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async createMoneyOut(req: AuthRequest, res: Response) {
    try {
      const { idInstrument, idInvestmentAccount, amount, date, idTransaction, note } = req.body;

      if (!idInstrument || !idInvestmentAccount || amount === undefined || amount === null || !date) {
        return responseHandler(res, {
          message: "idInstrument, idInvestmentAccount, amount, dan date wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const entry = await InvestmentTransactionService.createMoneyOut(req.currentUser!.idUser, {
        idInstrument,
        idInvestmentAccount,
        amount,
        date,
        idTransaction: idTransaction || null,
        ...(note && { note }),
      });

      return responseHandler(res, {
        message: "Uang keluar investasi berhasil dicatat",
        data: entry,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mencatat uang keluar investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async createTransfer(req: AuthRequest, res: Response) {
    try {
      const { idInstrument, idInvestmentAccount, idInstrumentTo, idInvestmentAccountTo, amount, date } = req.body;

      if (
        !idInstrument ||
        !idInvestmentAccount ||
        !idInstrumentTo ||
        !idInvestmentAccountTo ||
        amount === undefined ||
        amount === null ||
        !date
      ) {
        return responseHandler(res, {
          message:
            "idInstrument, idInvestmentAccount, idInstrumentTo, idInvestmentAccountTo, amount, dan date wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const entry = await InvestmentTransactionService.createTransfer(req.currentUser!.idUser, {
        idInstrument,
        idInvestmentAccount,
        idInstrumentTo,
        idInvestmentAccountTo,
        amount,
        date,
      });

      return responseHandler(res, {
        message: "Transfer investasi berhasil dicatat",
        data: entry,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mencatat transfer investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async createProfitLoss(req: AuthRequest, res: Response) {
    try {
      const { idInstrument, idInvestmentAccount, newCurrentValue, date } = req.body;

      if (!idInstrument || !idInvestmentAccount || newCurrentValue === undefined || newCurrentValue === null || !date) {
        return responseHandler(res, {
          message: "idInstrument, idInvestmentAccount, newCurrentValue, dan date wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const entry = await InvestmentTransactionService.createProfitLoss(req.currentUser!.idUser, {
        idInstrument,
        idInvestmentAccount,
        newCurrentValue,
        date,
      });

      return responseHandler(res, {
        message: "Perubahan nilai investasi berhasil dicatat",
        data: entry,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mencatat perubahan nilai investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { amount, date, note } = req.body;

      if (amount === undefined || amount === null || !date) {
        return responseHandler(res, {
          message: "amount dan date wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const entry = await InvestmentTransactionService.update(
        req.currentUser!.idUser,
        req.params.idInvestmentTransaction,
        { amount, date, ...(note !== undefined && { note }) }
      );

      return responseHandler(res, {
        message: "Transaksi investasi berhasil diperbarui",
        data: entry,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui transaksi investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await InvestmentTransactionService.remove(
        req.currentUser!.idUser,
        req.params.idInvestmentTransaction
      );
      return responseHandler(res, {
        message: "Transaksi investasi berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus transaksi investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
