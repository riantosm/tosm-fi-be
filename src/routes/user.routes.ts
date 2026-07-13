import express from "express";
import { UserController } from "../controllers/user.controller";
import { requireAdmin, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/register", UserController.register);
router.post("/login", UserController.login);
router.get("/", requireAuth, requireAdmin, UserController.getAll);

export default router;
