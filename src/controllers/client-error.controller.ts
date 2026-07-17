import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ClientErrorService } from "../services/client-error.service";
import { responseHandler } from "../utils/responseHandler";

export const ClientErrorController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const { source, message, stack, path, userAgent, extra } = req.body;

      if (!source || !message) {
        return responseHandler(res, {
          message: "source dan message wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const error = await ClientErrorService.create(req.user?.idUser ?? null, {
        source,
        message,
        stack,
        path,
        userAgent,
        extra,
      });

      return responseHandler(res, {
        message: "Error berhasil dicatat",
        data: error,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mencatat error",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const errors = await ClientErrorService.list();
      return responseHandler(res, {
        message: "Berhasil mengambil daftar error",
        data: errors,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil daftar error",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },
};
