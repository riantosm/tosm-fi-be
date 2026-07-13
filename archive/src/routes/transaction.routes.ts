import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";

const router = Router();

router.get("/", TransactionController.getAll);
router.get("/:id", TransactionController.getById);
router.post("/", TransactionController.create);
router.put("/:id", TransactionController.update);
router.delete("/delete/:id", TransactionController.delete);
router.delete("/reset", TransactionController.reset);
router.post("/transfer", TransactionController.transfer);
router.post("/profit", TransactionController.profit);

export default router;
