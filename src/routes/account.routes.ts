import express from "express";
import { AccountController } from "../controllers/account.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.delete("/data", requireAuth, requireActiveUser, AccountController.resetData);

export default router;
