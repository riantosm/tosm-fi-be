import express from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, requireActiveUser, TransactionController.list);
router.post("/", requireAuth, requireActiveUser, TransactionController.create);
router.patch("/:idTransaction", requireAuth, requireActiveUser, TransactionController.update);
router.delete("/:idTransaction", requireAuth, requireActiveUser, TransactionController.remove);

export default router;
