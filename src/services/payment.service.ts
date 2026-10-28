import crypto from "crypto";
import {
  ICheckoutResult,
  IMidtransStatus,
  IPaymentOrderStatus,
  PaymentStatus,
} from "../interfaces/payment.interface";
import { ISafeUser } from "../interfaces/user.interface";
import { PaymentOrderModel } from "../models/payment-order.model";
import { UserModel } from "../models/user.model";
import { PRO_LIFETIME_PRICE } from "../utils/plan";

// Midtrans Snap. MIDTRANS_IS_PRODUCTION=false (the default) uses the sandbox,
// where nothing is actually charged; going live only needs the env changed.
const isProduction = () => process.env.MIDTRANS_IS_PRODUCTION === "true";
const serverKey = () => process.env.MIDTRANS_SERVER_KEY ?? "";
const clientKey = () => process.env.MIDTRANS_CLIENT_KEY ?? "";
const snapBaseUrl = () =>
  isProduction() ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
const apiBaseUrl = () =>
  isProduction() ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
const authHeader = () => `Basic ${Buffer.from(`${serverKey()}:`).toString("base64")}`;

// Snap tokens live 24 hours; an unpaid order younger than this is reused.
const SNAP_TOKEN_REUSE_MS = 23 * 60 * 60 * 1000;

const assertConfigured = () => {
  if (!serverKey() || !clientKey()) throw new Error("Pembayaran belum dikonfigurasi");
};

/** Maps Midtrans' transaction_status (+ fraud_status for cards) onto ours. */
export function mapMidtransStatus(status: IMidtransStatus): PaymentStatus {
  switch (status.transaction_status) {
    case "settlement":
      return "paid";
    case "capture":
      return !status.fraud_status || status.fraud_status === "accept" ? "paid" : "pending";
    case "deny":
    case "cancel":
    case "failure":
      return "failed";
    case "expire":
      return "expired";
    default:
      return "pending";
  }
}

/** Midtrans signs notifications with SHA512(order_id + status_code + gross_amount + server key). */
export function isValidSignature(status: IMidtransStatus): boolean {
  if (!status.signature_key) return false;
  const expected = crypto
    .createHash("sha512")
    .update(`${status.order_id}${status.status_code}${status.gross_amount}${serverKey()}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(status.signature_key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const toStatus = (order: any): IPaymentOrderStatus => ({
  orderId: order.orderId,
  status: order.status,
  amount: order.amount,
  paymentType: order.paymentType ?? null,
  paidAt: order.paidAt ?? null,
});

async function fetchMidtransStatus(orderId: string): Promise<IMidtransStatus | null> {
  const res = await fetch(`${apiBaseUrl()}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: authHeader() },
  });
  const body = (await res.json().catch(() => null)) as IMidtransStatus | null;
  // 404 = the user hasn't picked a payment method in Snap yet.
  if (!body || body.status_code === "404" || !body.transaction_status) return null;
  return body;
}

/**
 * Applies a verified Midtrans status to our order. Idempotent: Midtrans may
 * notify more than once, and the status poll can race the notification, so
 * only the first transition to "paid" upgrades the user.
 */
async function applyStatus(orderId: string, status: IMidtransStatus): Promise<void> {
  const order = await PaymentOrderModel.findOne({ orderId });
  if (!order) throw new Error("Order tidak ditemukan");
  if (Number(status.gross_amount) !== order.amount) throw new Error("Nominal pembayaran tidak cocok");

  const next = mapMidtransStatus(status);
  const base = { midtransStatus: status.transaction_status ?? null, paymentType: status.payment_type ?? null };

  if (next === "paid") {
    const paid = await PaymentOrderModel.findOneAndUpdate(
      { orderId, status: { $ne: "paid" } },
      { ...base, status: "paid", paidAt: new Date() },
      { new: true }
    );
    if (paid) {
      await UserModel.updateOne(
        { _id: order.idUser },
        { plan: "pro", proSince: paid.paidAt, proSource: "payment" }
      );
    }
    return;
  }

  // Never move an already-paid order backwards.
  await PaymentOrderModel.updateOne({ orderId, status: { $ne: "paid" } }, { ...base, status: next });
}

export const PaymentService = {
  async checkoutProLifetime(user: ISafeUser): Promise<ICheckoutResult> {
    assertConfigured();
    if (user.plan === "pro") throw new Error("Akun ini sudah Pro");

    const reusable = await PaymentOrderModel.findOne({
      idUser: user.idUser,
      status: "pending",
      isProduction: isProduction(),
      snapToken: { $ne: null },
      createdAt: { $gte: new Date(Date.now() - SNAP_TOKEN_REUSE_MS) },
      amount: PRO_LIFETIME_PRICE,
    }).sort({ createdAt: -1 });

    if (reusable) {
      return {
        orderId: reusable.orderId,
        snapToken: reusable.snapToken!,
        redirectUrl: reusable.redirectUrl ?? "",
        clientKey: clientKey(),
        isProduction: isProduction(),
        amount: reusable.amount,
      };
    }

    const orderId = `TFPRO-${user.idUser.slice(-8)}-${Date.now()}`;
    const res = await fetch(`${snapBaseUrl()}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: PRO_LIFETIME_PRICE },
        item_details: [
          { id: "pro_lifetime", price: PRO_LIFETIME_PRICE, quantity: 1, name: "TosmFi Pro Lifetime" },
        ],
        customer_details: { first_name: user.nameUser.slice(0, 50) },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
    };
    if (!res.ok || !body.token) {
      console.error("[payment] Snap error:", res.status, body.error_messages);
      throw new Error("Gagal membuat pembayaran, coba lagi sebentar");
    }

    await PaymentOrderModel.create({
      orderId,
      idUser: user.idUser,
      amount: PRO_LIFETIME_PRICE,
      snapToken: body.token,
      redirectUrl: body.redirect_url ?? null,
      isProduction: isProduction(),
    });

    return {
      orderId,
      snapToken: body.token,
      redirectUrl: body.redirect_url ?? "",
      clientKey: clientKey(),
      isProduction: isProduction(),
      amount: PRO_LIFETIME_PRICE,
    };
  },

  /** Midtrans HTTP notification. The payload is only trusted after its signature checks out. */
  async handleNotification(payload: IMidtransStatus): Promise<void> {
    if (!isValidSignature(payload)) throw new Error("Signature tidak valid");
    // Re-read the status from Midtrans itself rather than relying on the body alone.
    const status = (await fetchMidtransStatus(payload.order_id)) ?? payload;
    await applyStatus(payload.order_id, status);
  },

  /**
   * The frontend polls this after Snap closes. It also pulls the status from
   * Midtrans directly, so payments complete even where Midtrans can't reach
   * the notification URL (local development).
   */
  async getOrderStatus(idUser: string, orderId: string): Promise<IPaymentOrderStatus> {
    const order = await PaymentOrderModel.findOne({ orderId, idUser });
    if (!order) throw new Error("Order tidak ditemukan");

    if (order.status === "pending" && serverKey()) {
      const status = await fetchMidtransStatus(orderId);
      if (status) await applyStatus(orderId, status);
      return toStatus(await PaymentOrderModel.findOne({ orderId }).lean());
    }
    return toStatus(order);
  },
};
