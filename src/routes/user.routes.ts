import express from "express";
import { UserController } from "../controllers/user.controller";
import {
  requireActiveUser,
  requireAdmin,
  requireAuth,
} from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/me", requireAuth, requireActiveUser, UserController.me);
router.patch("/me", requireAuth, requireActiveUser, UserController.updateProfile);
router.patch("/me/password", requireAuth, requireActiveUser, UserController.changePassword);
router.get(
  "/get-list-user",
  requireAuth,
  requireActiveUser,
  requireAdmin,
  UserController.getListUser
);
router.post(
  "/accept-user",
  requireAuth,
  requireActiveUser,
  requireAdmin,
  UserController.acceptUser
);

export default router;
