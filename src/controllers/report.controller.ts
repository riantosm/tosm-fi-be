import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ReportService } from "../services/report.service";
import { responseHandler } from "../utils/responseHandler";
import { instantToLocalFieldsDate, parseTzOffsetMinutes } from "../utils/timezone";

function currentMonthParam(tzOffsetMinutes: number): string {
  const now = instantToLocalFieldsDate(new Date(), tzOffsetMinutes);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const ReportController = {
  async summary(req: AuthRequest, res: Response) {
    try {
      const { dateFrom, dateTo, previousDateFrom, previousDateTo, tzOffsetMinutes } = req.query;
      if (!dateFrom || !dateTo || !previousDateFrom || !previousDateTo) {
        return responseHandler(res, {
          message: "dateFrom, dateTo, previousDateFrom, dan previousDateTo wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const summary = await ReportService.getSummary(
        req.currentUser!.idUser,
        dateFrom as string,
        dateTo as string,
        previousDateFrom as string,
        previousDateTo as string,
        parseTzOffsetMinutes(tzOffsetMinutes),
      );

      return responseHandler(res, { message: "Berhasil mengambil ringkasan laporan", data: summary });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil ringkasan laporan",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async walletUsage(req: AuthRequest, res: Response) {
    try {
      const { dateFrom, dateTo, tzOffsetMinutes } = req.query;
      if (!dateFrom || !dateTo) {
        return responseHandler(res, {
          message: "dateFrom dan dateTo wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const items = await ReportService.getWalletUsage(
        req.currentUser!.idUser,
        dateFrom as string,
        dateTo as string,
        parseTzOffsetMinutes(tzOffsetMinutes),
      );

      return responseHandler(res, { message: "Berhasil mengambil penggunaan dompet", data: items });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil penggunaan dompet",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async topSpending(req: AuthRequest, res: Response) {
    try {
      const { dateFrom, dateTo, limit, tzOffsetMinutes } = req.query;
      if (!dateFrom || !dateTo) {
        return responseHandler(res, {
          message: "dateFrom dan dateTo wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const items = await ReportService.getTopSpending(
        req.currentUser!.idUser,
        dateFrom as string,
        dateTo as string,
        limit ? Number(limit) : 10,
        parseTzOffsetMinutes(tzOffsetMinutes),
      );

      return responseHandler(res, { message: "Berhasil mengambil pengeluaran terbesar", data: items });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil pengeluaran terbesar",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async cashFlow(req: AuthRequest, res: Response) {
    try {
      const { dateFrom, dateTo, locale, tzOffsetMinutes } = req.query;
      if (!dateFrom || !dateTo) {
        return responseHandler(res, {
          message: "dateFrom dan dateTo wajib diisi",
          isSuccess: false,
          status: 400,
        });
      }

      const points = await ReportService.getCashFlow(
        req.currentUser!.idUser,
        dateFrom as string,
        dateTo as string,
        (locale as string) || "id",
        parseTzOffsetMinutes(tzOffsetMinutes),
      );

      return responseHandler(res, { message: "Berhasil mengambil cash flow", data: points });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil cash flow",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async monthlyTrend(req: AuthRequest, res: Response) {
    try {
      const { months, locale, tzOffsetMinutes } = req.query;

      const points = await ReportService.getMonthlyTrend(
        req.currentUser!.idUser,
        months ? Number(months) : 12,
        (locale as string) || "id",
        parseTzOffsetMinutes(tzOffsetMinutes),
      );

      return responseHandler(res, { message: "Berhasil mengambil tren bulanan", data: points });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil tren bulanan",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },

  async dashboardSummary(req: AuthRequest, res: Response) {
    try {
      const { month, tzOffsetMinutes } = req.query;
      const tz = parseTzOffsetMinutes(tzOffsetMinutes);

      const summary = await ReportService.getDashboardSummary(
        req.currentUser!.idUser,
        (month as string) || currentMonthParam(tz),
        tz,
      );

      return responseHandler(res, { message: "Berhasil mengambil ringkasan dashboard", data: summary });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil ringkasan dashboard",
        isSuccess: false,
        status: 500,
        error,
      });
    }
  },
};
