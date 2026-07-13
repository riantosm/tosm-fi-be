import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { UserService } from "../services/user.service";
import { responseHandler } from "../utils/responseHandler";

export const UserController = {
  async me(req: AuthRequest, res: Response) {
    return responseHandler(res, {
      message: "Berhasil mengambil data user",
      data: req.currentUser,
    });
  },

  async getListUser(req: AuthRequest, res: Response) {
    try {
      const users = await UserService.getList();
      return responseHandler(res, {
        message: "Berhasil mengambil daftar user",
        data: users,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Gagal mengambil daftar user",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async acceptUser(req: AuthRequest, res: Response) {
    try {
      const { idUser } = req.body;

      if (!idUser) {
        return responseHandler(res, {
          message: "idUser wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const user = await UserService.acceptUser(idUser);

      return responseHandler(res, {
        message: "User berhasil divalidasi",
        data: user,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memvalidasi user",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
