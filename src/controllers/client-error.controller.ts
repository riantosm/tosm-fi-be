import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ClientErrorService } from "../services/client-error.service";
import { responseHandler } from "../utils/responseHandler";

export const ClientErrorController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const { source, environment, message, stack, path, userAgent, extra } = req.body;

      if (!source || !message || !environment) {
        return responseHandler(res, {
          message: "source, environment, dan message wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const error = await ClientErrorService.create(req.user?.idUser ?? null, {
        source,
        environment,
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
      const { search, environment, source } = req.query;
      const errors = await ClientErrorService.list({
        search: typeof search === "string" ? search : undefined,
        environment: environment === "development" || environment === "production"
          ? environment
          : undefined,
        source: typeof source === "string" ? source : undefined,
      });
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

  async remove(req: AuthRequest, res: Response) {
    try {
      await ClientErrorService.remove(req.params.idClientError);
      return responseHandler(res, {
        message: "Error berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus error",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
