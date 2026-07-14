import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { TransactionService } from "../services/transaction.service";
import { responseHandler } from "../utils/responseHandler";

export const TransactionController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const { month, type, idWallet, idCategory, idSubCategory, dateFrom, dateTo, search, sort, page, limit } =
        req.query;

      const result = await TransactionService.getList(req.currentUser!.idUser, {
        month: month as string | undefined,
        type: type as any,
        idWallet: idWallet as string | undefined,
        idCategory: idCategory as string | undefined,
        idSubCategory: idSubCategory as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        search: search as string | undefined,
        sort: sort as any,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return responseHandler(res, {
        message: "Berhasil mengambil daftar transaksi",
        data: result,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil daftar transaksi",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { type, idWallet, idCategory, idSubCategory, idWalletFrom, idWalletTo, title, notes, amount, date } =
        req.body;

      if (!type || !title || amount === undefined || amount === null || !date) {
        return responseHandler(res, {
          message: "type, title, amount, dan date wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const transaction = await TransactionService.create(req.currentUser!.idUser, {
        type,
        idWallet,
        idCategory,
        idSubCategory,
        idWalletFrom,
        idWalletTo,
        title,
        notes,
        amount,
        date,
      });

      return responseHandler(res, {
        message: "Transaksi berhasil dibuat",
        data: transaction,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat transaksi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { type, idWallet, idCategory, idSubCategory, idWalletFrom, idWalletTo, title, notes, amount, date } =
        req.body;

      if (!type || !title || amount === undefined || amount === null || !date) {
        return responseHandler(res, {
          message: "type, title, amount, dan date wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const transaction = await TransactionService.update(
        req.currentUser!.idUser,
        req.params.idTransaction,
        { type, idWallet, idCategory, idSubCategory, idWalletFrom, idWalletTo, title, notes, amount, date },
      );

      return responseHandler(res, {
        message: "Transaksi berhasil diperbarui",
        data: transaction,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui transaksi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await TransactionService.remove(req.currentUser!.idUser, req.params.idTransaction);
      return responseHandler(res, {
        message: "Transaksi berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus transaksi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
