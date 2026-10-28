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
router.get("/me/plan", requireAuth, requireActiveUser, UserController.plan);
router.get(
  "/get-list-user",
  requireAuth,
  requireActiveUser,
  requireAdmin,
  UserController.getListUser
);
router.patch(
  "/:idUser/plan",
  requireAuth,
  requireActiveUser,
  requireAdmin,
  UserController.setPlan
);
// Approval is no longer required (accounts are active on registration); kept
// so older clients that still call it don't break.
router.post(
  "/accept-user",
  requireAuth,
  requireActiveUser,
  requireAdmin,
  UserController.acceptUser
);

export default router;
