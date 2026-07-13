import express from "express";
import { WalletController } from "../controllers/wallet.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, requireActiveUser, WalletController.list);
router.post("/", requireAuth, requireActiveUser, WalletController.create);
// Registered before "/:idWallet" so "reorder" isn't matched as an idWallet param.
router.patch("/reorder", requireAuth, requireActiveUser, WalletController.reorder);
router.patch("/:idWallet/primary", requireAuth, requireActiveUser, WalletController.setPrimary);
router.patch("/:idWallet", requireAuth, requireActiveUser, WalletController.update);
router.delete("/:idWallet", requireAuth, requireActiveUser, WalletController.remove);

export default router;
