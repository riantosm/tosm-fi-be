import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { InstrumentService } from "../services/instrument.service";
import { responseHandler } from "../utils/responseHandler";

export const InstrumentController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const instruments = await InstrumentService.getList(req.currentUser!.idUser);
      return responseHandler(res, {
        message: "Berhasil mengambil daftar instrumen investasi",
        data: instruments,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: "Gagal mengambil daftar instrumen investasi",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { nameInstrument, color } = req.body;

      if (!nameInstrument || !color) {
        return responseHandler(res, {
          message: "nameInstrument dan color wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const instrument = await InstrumentService.create(req.currentUser!.idUser, {
        nameInstrument,
        color,
      });

      return responseHandler(res, {
        message: "Instrumen investasi berhasil dibuat",
        data: instrument,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat instrumen investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { nameInstrument, color } = req.body;

      if (!nameInstrument || !color) {
        return responseHandler(res, {
          message: "nameInstrument dan color wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const instrument = await InstrumentService.update(
        req.currentUser!.idUser,
        req.params.idInstrument,
        { nameInstrument, color }
      );

      return responseHandler(res, {
        message: "Instrumen investasi berhasil diperbarui",
        data: instrument,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui instrumen investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await InstrumentService.remove(req.currentUser!.idUser, req.params.idInstrument);
      return responseHandler(res, {
        message: "Instrumen investasi berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus instrumen investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async createInvestmentAccount(req: AuthRequest, res: Response) {
    try {
      const { nameInvestmentAccount } = req.body;

      if (!nameInvestmentAccount) {
        return responseHandler(res, {
          message: "nameInvestmentAccount wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const account = await InstrumentService.createInvestmentAccount(
        req.currentUser!.idUser,
        req.params.idInstrument,
        { nameInvestmentAccount }
      );

      return responseHandler(res, {
        message: "Akun investasi berhasil dibuat",
        data: account,
        status: 201,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat akun investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async updateInvestmentAccount(req: AuthRequest, res: Response) {
    try {
      const { nameInvestmentAccount } = req.body;

      if (!nameInvestmentAccount) {
        return responseHandler(res, {
          message: "nameInvestmentAccount wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const account = await InstrumentService.updateInvestmentAccount(
        req.currentUser!.idUser,
        req.params.idInstrument,
        req.params.idInvestmentAccount,
        { nameInvestmentAccount }
      );

      return responseHandler(res, {
        message: "Akun investasi berhasil diperbarui",
        data: account,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui akun investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async removeInvestmentAccount(req: AuthRequest, res: Response) {
    try {
      await InstrumentService.removeInvestmentAccount(
        req.currentUser!.idUser,
        req.params.idInstrument,
        req.params.idInvestmentAccount
      );

      return responseHandler(res, {
        message: "Akun investasi berhasil dihapus",
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus akun investasi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
