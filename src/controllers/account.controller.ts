import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AccountService } from "../services/account.service";
import { responseHandler } from "../utils/responseHandler";

export const AccountController = {
  async resetData(req: AuthRequest, res: Response) {
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
