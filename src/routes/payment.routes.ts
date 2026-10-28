import express from "express";
import { PaymentController } from "../controllers/payment.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/pro/checkout", requireAuth, requireActiveUser, PaymentController.checkoutPro);
// Payment Notification URL to set in the Midtrans dashboard.
router.post("/midtrans/notify", PaymentController.midtransNotification);
router.get("/orders/:orderId", requireAuth, requireActiveUser, PaymentController.orderStatus);

export default router;
