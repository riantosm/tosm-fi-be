import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { WalletService } from "../services/wallet.service";
import { responseHandler } from "../utils/responseHandler";

export const WalletController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const wallets = await WalletService.getList(req.currentUser!.idUser);
      return responseHandler(res, {
        message: "Berhasil mengambil daftar wallet",
        data: wallets,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Gagal mengambil daftar wallet",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { nameWallet, color, balance } = req.body;

      if (!nameWallet || !color) {
        return responseHandler(res, {
          message: "nameWallet dan color wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const wallet = await WalletService.create(req.currentUser!.idUser, {
        nameWallet,
        color,
        balance,
      });

      return responseHandler(res, {
        message: "Wallet berhasil dibuat",
        data: wallet,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat wallet",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { nameWallet, color } = req.body;

      if (!nameWallet || !color) {
        return responseHandler(res, {
          message: "nameWallet dan color wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const wallet = await WalletService.update(
        req.currentUser!.idUser,
        req.params.idWallet,
        { nameWallet, color }
      );

      return responseHandler(res, {
        message: "Wallet berhasil diperbarui",
        data: wallet,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui wallet",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await WalletService.remove(req.currentUser!.idUser, req.params.idWallet);
      return responseHandler(res, {
        message: "Wallet berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus wallet",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async setPrimary(req: AuthRequest, res: Response) {
    try {
      const wallets = await WalletService.setPrimary(
        req.currentUser!.idUser,
        req.params.idWallet
      );

      return responseHandler(res, {
        message: "Wallet utama berhasil diubah",
        data: wallets,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengubah wallet utama",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async reorder(req: AuthRequest, res: Response) {
    try {
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return responseHandler(res, {
          message: "orderedIds wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const wallets = await WalletService.reorder(req.currentUser!.idUser, orderedIds);

      return responseHandler(res, {
        message: "Urutan wallet berhasil disimpan",
        data: wallets,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menyimpan urutan wallet",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
