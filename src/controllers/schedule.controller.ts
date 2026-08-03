import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ScheduleService } from "../services/schedule.service";
import { responseHandler } from "../utils/responseHandler";

export const ScheduleController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const schedules = await ScheduleService.list(req.currentUser!.idUser);
      return responseHandler(res, { message: "Berhasil mengambil daftar jadwal", data: schedules });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil daftar jadwal",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { title, notes, type, amount, idWallet, idCategory, idSubCategory, frequency, weekdays, startDate } =
        req.body;

      if (!title || !type || amount === undefined || amount === null || !idWallet || !idCategory || !frequency || !startDate) {
        return responseHandler(res, {
          message: "title, type, amount, idWallet, idCategory, frequency, dan startDate wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const schedule = await ScheduleService.create(req.currentUser!.idUser, {
        title,
        notes,
        type,
        amount,
        idWallet,
        idCategory,
        idSubCategory,
        frequency,
        weekdays,
        startDate,
      });

      return responseHandler(res, { message: "Jadwal berhasil dibuat", data: schedule, status: 201 });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat jadwal",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { title, notes, type, amount, idWallet, idCategory, idSubCategory, frequency, weekdays, startDate } =
        req.body;

      if (!title || !type || amount === undefined || amount === null || !idWallet || !idCategory || !frequency || !startDate) {
        return responseHandler(res, {
          message: "title, type, amount, idWallet, idCategory, frequency, dan startDate wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const schedule = await ScheduleService.update(req.currentUser!.idUser, req.params.idSchedule, {
        title,
        notes,
        type,
        amount,
        idWallet,
        idCategory,
        idSubCategory,
        frequency,
        weekdays,
        startDate,
      });

      return responseHandler(res, { message: "Jadwal berhasil diperbarui", data: schedule });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal memperbarui jadwal",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async setActive(req: AuthRequest, res: Response) {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return responseHandler(res, {
          message: "isActive wajib diisi (boolean)",
          isSuccess: false,
          status: 400,
        });
      }

      const schedule = await ScheduleService.setActive(req.currentUser!.idUser, req.params.idSchedule, isActive);
      return responseHandler(res, {
        message: isActive ? "Jadwal diaktifkan" : "Jadwal dijeda",
        data: schedule,
      });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengubah status jadwal",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await ScheduleService.remove(req.currentUser!.idUser, req.params.idSchedule);
      return responseHandler(res, { message: "Jadwal berhasil dihapus" });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal menghapus jadwal",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async listOccurrences(req: AuthRequest, res: Response) {
    try {
      const occurrences = await ScheduleService.listPendingOccurrences(req.currentUser!.idUser);
      return responseHandler(res, { message: "Berhasil mengambil daftar jadwal menunggu", data: occurrences });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil daftar jadwal menunggu",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async payOccurrence(req: AuthRequest, res: Response) {
    try {
      const { amount, date, idWallet, idCategory, idSubCategory, title, notes } = req.body;
      const result = await ScheduleService.pay(req.currentUser!.idUser, req.params.idOccurrence, {
        amount,
        date,
        idWallet,
        idCategory,
        idSubCategory,
        title,
        notes,
      });
      return responseHandler(res, { message: "Transaksi berhasil dikonfirmasi", data: result, status: 201 });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengonfirmasi transaksi",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async cancelOccurrence(req: AuthRequest, res: Response) {
    try {
      const occurrence = await ScheduleService.cancel(req.currentUser!.idUser, req.params.idOccurrence);
      return responseHandler(res, { message: "Jadwal dibatalkan", data: occurrence });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membatalkan jadwal",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },
};
