import { Router } from "express";
import { AccountTypeController } from "../controllers/accountType.controller";

const router = Router();

router.get("/", AccountTypeController.getAll);
router.get("/:id", AccountTypeController.getById);
router.post("/", AccountTypeController.create);
router.put("/:id", AccountTypeController.update);
router.delete("/:id", AccountTypeController.delete);

export default router;
