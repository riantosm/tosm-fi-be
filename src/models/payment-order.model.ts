import mongoose, { Schema } from "mongoose";
import { IPaymentOrder } from "../interfaces/payment.interface";

const PaymentOrderSchema = new Schema<IPaymentOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    idUser: { type: String, required: true, index: true },
    product: { type: String, enum: ["pro_lifetime"], default: "pro_lifetime" },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
    },
    snapToken: { type: String, default: null },
    redirectUrl: { type: String, default: null },
    paymentType: { type: String, default: null },
    midtransStatus: { type: String, default: null },
    isProduction: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PaymentOrderModel = mongoose.model<IPaymentOrder>("PaymentOrder", PaymentOrderSchema);
