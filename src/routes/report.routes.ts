import express from "express";
import { ReportController } from "../controllers/report.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/dashboard-summary", requireAuth, requireActiveUser, ReportController.dashboardSummary);
router.get("/summary", requireAuth, requireActiveUser, ReportController.summary);
router.get("/wallet-usage", requireAuth, requireActiveUser, ReportController.walletUsage);
router.get("/top-spending", requireAuth, requireActiveUser, ReportController.topSpending);
router.get("/cash-flow", requireAuth, requireActiveUser, ReportController.cashFlow);
router.get("/monthly-trend", requireAuth, requireActiveUser, ReportController.monthlyTrend);

export default router;
