import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { PaymentService } from "../services/payment.service";
import { responseHandler } from "../utils/responseHandler";

export const PaymentController = {
  async checkoutPro(req: AuthRequest, res: Response) {
    try {
      const result = await PaymentService.checkoutProLifetime(req.currentUser!);
      return responseHandler(res, { message: "Pembayaran siap", data: result, status: 201 });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal membuat pembayaran",
        isSuccess: false,
        status: 400,
        error,
      });
    }
  },

  async orderStatus(req: AuthRequest, res: Response) {
    try {
      const status = await PaymentService.getOrderStatus(req.currentUser!.idUser, req.params.orderId);
      return responseHandler(res, { message: "Berhasil mengambil status pembayaran", data: status });
    } catch (error: any) {
      return responseHandler(res, {
        message: error.message || "Gagal mengambil status pembayaran",
        isSuccess: false,
        status: 404,
        error,
      });
    }
  },

  // Called by Midtrans, not by our clients: no auth, the signature is the check.
  async midtransNotification(req: Request, res: Response) {
    try {
      await PaymentService.handleNotification(req.body ?? {});
      return responseHandler(res, { message: "OK" });
    } catch (error: any) {
      console.error("[payment] notification rejected:", error.message);
      const message = error.message || "Notifikasi ditolak";
      // Answer 200 for an order we don't know (e.g. the dashboard's test
      // notification) so Midtrans stops retrying; a bad signature gets 400.
      const status = message === "Order tidak ditemukan" ? 200 : 400;
      return responseHandler(res, { message, isSuccess: status === 200, status });
    }
  },
};
