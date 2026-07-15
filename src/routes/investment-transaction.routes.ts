import express from "express";
import { InvestmentTransactionController } from "../controllers/investment-transaction.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, requireActiveUser, InvestmentTransactionController.list);
router.get(
  "/net-worth-timeline",
  requireAuth,
  requireActiveUser,
  InvestmentTransactionController.netWorthTimeline
);

router.post("/in", requireAuth, requireActiveUser, InvestmentTransactionController.createMoneyIn);
router.post("/out", requireAuth, requireActiveUser, InvestmentTransactionController.createMoneyOut);
router.post("/transfer", requireAuth, requireActiveUser, InvestmentTransactionController.createTransfer);
router.post("/pl", requireAuth, requireActiveUser, InvestmentTransactionController.createProfitLoss);

router.patch(
  "/:idInvestmentTransaction",
  requireAuth,
  requireActiveUser,
  InvestmentTransactionController.update
);
router.delete(
  "/:idInvestmentTransaction",
  requireAuth,
  requireActiveUser,
  InvestmentTransactionController.remove
);

export default router;
