import { NextFunction, Response } from "express";
import { BudgetModel } from "../models/budget.model";
import { CategoryModel } from "../models/category.model";
import { InstrumentModel } from "../models/instrument.model";
import { ScheduleModel } from "../models/schedule.model";
import { WalletModel } from "../models/wallet.model";
import { parseTzOffsetMinutes } from "../utils/timezone";
import { PLAN_LIMITS, PlanLimitError, planLimitResponse, reportMinDate } from "../utils/plan";
import { AuthRequest } from "./auth.middleware";

// Every middleware here runs after requireActiveUser, so req.currentUser.plan
// is the freshly-loaded effective plan.

type CountedFeature = "wallets" | "categories" | "budgets" | "schedules" | "instruments";

const COUNTERS: Record<CountedFeature, (idUser: string) => Promise<number>> = {
  wallets: (idUser) => WalletModel.countDocuments({ idUser }),
  categories: (idUser) => CategoryModel.countDocuments({ idUser }),
  budgets: (idUser) => BudgetModel.countDocuments({ idUser }),
  schedules: (idUser) => ScheduleModel.countDocuments({ idUser }),
  instruments: (idUser) => InstrumentModel.countDocuments({ idUser }),
};

const LABELS: Record<CountedFeature, string> = {
  wallets: "dompet",
  categories: "kategori",
  budgets: "budget",
  schedules: "jadwal",
  instruments: "instrumen investasi",
};

/** Blocks creating one more document once the Free plan's count limit is reached. */
export const requirePlanQuota =
  (feature: CountedFeature) => async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { idUser, plan } = req.currentUser!;
      const limit = PLAN_LIMITS[plan][feature];
      if (limit === null) return next();

      const count = await COUNTERS[feature](idUser);
      if (count >= limit) {
        throw new PlanLimitError(
          feature,
          `Paket Free maksimal ${limit} ${LABELS[feature]}. Upgrade ke Pro untuk menambah lagi.`,
          limit
        );
      }
      next();
    } catch (error: any) {
      if (error instanceof PlanLimitError) return planLimitResponse(res, error);
      next(error);
    }
  };

export const requireProSubCategories = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (PLAN_LIMITS[req.currentUser!.plan].subCategories) return next();
  return planLimitResponse(
    res,
    new PlanLimitError("subCategories", "Subkategori hanya tersedia di paket Pro.")
  );
};

export const requireProMonthlyTrend = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (PLAN_LIMITS[req.currentUser!.plan].monthlyTrend) return next();
  return planLimitResponse(
    res,
    new PlanLimitError("monthlyTrend", "Tren 12 bulan hanya tersedia di paket Pro.")
  );
};

/** Free reports may not start before the 1st of last month (client local calendar). */
export const limitReportRange = (req: AuthRequest, res: Response, next: NextFunction) => {
  const monthsBack = PLAN_LIMITS[req.currentUser!.plan].reportMonthsBack;
  if (monthsBack === null) return next();

  const minDate = reportMinDate(monthsBack, parseTzOffsetMinutes(req.query.tzOffsetMinutes));
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
  if (dateFrom && dateFrom.slice(0, 10) < minDate) {
    return planLimitResponse(
      res,
      new PlanLimitError(
        "reportRange",
        "Paket Free hanya bisa melihat laporan bulan ini dan bulan lalu. Upgrade ke Pro untuk periode lainnya."
      )
    );
  }
  next();
};
