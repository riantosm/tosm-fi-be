import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AccountService } from "../services/account.service";
import { responseHandler } from "../utils/responseHandler";

export const AccountController = {
  async resetData(req: AuthRequest, res: Response) {
    if (req.currentUser!.isDemo) {
      return responseHandler(res, {
        message: "Akun demo tidak bisa mereset data",
        isSuccess: false,
        status: 403,
      });
    }

    try {
      await AccountService.resetData(req.currentUser!.idUser);
      return responseHandler(res, {
        message: "Semua data berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus data",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
