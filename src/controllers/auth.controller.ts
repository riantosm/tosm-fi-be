import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AuthService } from "../services/auth.service";
import { responseHandler } from "../utils/responseHandler";

export const AuthController = {
  async register(req: AuthRequest, res: Response) {
    try {
      const { nameUser, username, password } = req.body;

      if (!nameUser || !username || !password) {
        return responseHandler(res, {
          message: "nameUser, username, dan password wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const user = await AuthService.register({ nameUser, username, password });

      return responseHandler(res, {
        message:
          user.status === "active"
            ? "Registrasi berhasil"
            : "Registrasi berhasil, menunggu validasi admin",
        data: user,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mendaftar",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async login(req: AuthRequest, res: Response) {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login({ username, password });

      return responseHandler(res, {
        message: "Login berhasil",
        data: result,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal login",
        isSuccess: false,
        status: 401,
        error,
      });
    }
  },

  async logout(req: AuthRequest, res: Response) {
    try {
      await AuthService.logout(req.user!.idUser);

      return responseHandler(res, {
        message: "Logout berhasil",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal logout",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
