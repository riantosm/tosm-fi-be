import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";

const router = Router();

router.get("/", DashboardController.get);
router.get("/line-chart", DashboardController.getLineChart);
router.get("/compared-line-chart", DashboardController.getComparedLineChart);

export default router;
