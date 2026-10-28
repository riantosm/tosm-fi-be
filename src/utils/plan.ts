import { Response } from "express";
import { ISafeUser, UserPlan, UserRole } from "../interfaces/user.interface";
import { isDemoUsername } from "./demo";
import { responseHandler } from "./responseHandler";

// Pro is a one-time "lifetime" purchase (see payment.service.ts).
export const PRO_LIFETIME_PRICE = Number(process.env.PRO_LIFETIME_PRICE) || 149000;

export type PlanFeature =
  | "wallets"
  | "categories"
  | "subCategories"
  | "budgets"
  | "schedules"
  | "instruments"
  | "reportRange"
  | "monthlyTrend"
  | "aiMessages"
  | "receiptScan";

export interface IPlanLimits {
  wallets: number | null;
  categories: number | null;
  budgets: number | null;
  schedules: number | null;
  instruments: number | null;
  aiMessagesPerMonth: number | null;
  subCategories: boolean;
  receiptScan: boolean;
  monthlyTrend: boolean;
  customReportRange: boolean;
  exportPdfExcel: boolean;
  // Free reports may only look back to the 1st of last month.
  reportMonthsBack: number | null;
}

// null = unlimited. Existing documents above a limit stay readable/editable;
// limits only block creating more.
export const PLAN_LIMITS: Record<UserPlan, IPlanLimits> = {
  free: {
    wallets: 3,
    categories: 10,
    budgets: 1,
    schedules: 3,
    instruments: 1,
    aiMessagesPerMonth: 20,
    subCategories: false,
    receiptScan: false,
    monthlyTrend: false,
    customReportRange: false,
    exportPdfExcel: false,
    reportMonthsBack: 1,
  },
  pro: {
    wallets: null,
    categories: null,
    budgets: null,
    schedules: null,
    instruments: null,
    aiMessagesPerMonth: 100,
    subCategories: true,
    receiptScan: true,
    monthlyTrend: true,
    customReportRange: true,
    exportPdfExcel: true,
    reportMonthsBack: null,
  },
};

// Admins always get Pro. Documents created before the plan field existed have
// no `plan` (lean reads skip schema defaults), so they read as "free".
export const effectivePlan = (user: { role: UserRole; plan?: UserPlan | null }): UserPlan =>
  user.role === "admin" ? "pro" : user.plan === "pro" ? "pro" : "free";

export const toSafeUser = (user: any): ISafeUser => ({
  idUser: user._id.toString(),
  nameUser: user.nameUser,
  username: user.username,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  plan: effectivePlan(user),
  proSince: user.proSince ?? null,
  isDemo: isDemoUsername(user.username),
});

export class PlanLimitError extends Error {
  constructor(
    public feature: PlanFeature,
    message: string,
    public limit: number | null = null
  ) {
    super(message);
  }
}

// 403 with `data.code = "PLAN_LIMIT"` — the frontend opens its Upgrade dialog on this.
export const planLimitResponse = (res: Response, error: PlanLimitError) =>
  responseHandler(res, {
    message: error.message,
    isSuccess: false,
    status: 403,
    data: { error: error.message, code: "PLAN_LIMIT", feature: error.feature, limit: error.limit },
  });

/** "YYYY-MM" of the client's local calendar. */
export const localMonthKey = (tzOffsetMinutes: number, date = new Date()): string => {
  const local = new Date(date.getTime() - tzOffsetMinutes * 60000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** "YYYY-MM-DD" of the 1st day `monthsBack` months before the client's current month. */
export const reportMinDate = (monthsBack: number, tzOffsetMinutes: number): string => {
  const local = new Date(Date.now() - tzOffsetMinutes * 60000);
  const first = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1));
  return first.toISOString().slice(0, 10);
};
