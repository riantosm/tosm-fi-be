import express from "express";
import { ReportController } from "../controllers/report.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";
import { limitReportRange, requireProMonthlyTrend } from "../middlewares/plan.middleware";

const router = express.Router();

router.get("/dashboard-summary", requireAuth, requireActiveUser, ReportController.dashboardSummary);
router.get("/summary", requireAuth, requireActiveUser, limitReportRange, ReportController.summary);
router.get("/wallet-usage", requireAuth, requireActiveUser, limitReportRange, ReportController.walletUsage);
router.get("/top-spending", requireAuth, requireActiveUser, limitReportRange, ReportController.topSpending);
router.get("/cash-flow", requireAuth, requireActiveUser, limitReportRange, ReportController.cashFlow);
router.get("/monthly-trend", requireAuth, requireActiveUser, requireProMonthlyTrend, ReportController.monthlyTrend);

export default router;
