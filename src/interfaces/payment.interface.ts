export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface IPaymentOrder {
  orderId: string;
  idUser: string;
  product: "pro_lifetime";
  amount: number;
  status: PaymentStatus;
  snapToken: string | null;
  redirectUrl: string | null;
  paymentType: string | null;
  // Midtrans' own transaction_status ("pending", "settlement", "expire", ...).
  midtransStatus: string | null;
  isProduction: boolean;
  paidAt: Date | null;
  createdAt?: Date;
}

export interface ICheckoutResult {
  orderId: string;
  snapToken: string;
  redirectUrl: string;
  clientKey: string;
  isProduction: boolean;
  amount: number;
}

export interface IPaymentOrderStatus {
  orderId: string;
  status: PaymentStatus;
  amount: number;
  paymentType: string | null;
  paidAt: Date | null;
}

/** Fields of a Midtrans HTTP notification / status response that we use. */
export interface IMidtransStatus {
  order_id: string;
  status_code: string;
  gross_amount: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  signature_key?: string;
}
