import { Router } from "express";
import { TransactionTypeController } from "../controllers/transactionType.controller";

const router = Router();

router.get("/", TransactionTypeController.getAll);
router.get("/:id", TransactionTypeController.getById);
router.post("/", TransactionTypeController.create);
router.put("/:id", TransactionTypeController.update);
router.delete("/:id", TransactionTypeController.delete);

export default router;
