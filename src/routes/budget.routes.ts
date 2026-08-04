import express from "express";
import { BudgetController } from "../controllers/budget.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, requireActiveUser, BudgetController.list);
router.post("/", requireAuth, requireActiveUser, BudgetController.create);
router.patch("/:idBudget", requireAuth, requireActiveUser, BudgetController.update);
router.delete("/:idBudget", requireAuth, requireActiveUser, BudgetController.remove);

export default router;
