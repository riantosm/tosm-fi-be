import express from "express";
import { ClientErrorController } from "../controllers/client-error.controller";
import { requireActiveUser, requireAdmin, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// requireAuth only (no requireActiveUser) — a pending user's crash should
// still be captured, and reporting is best-effort/fire-and-forget from the
// frontend anyway, so it doesn't need the full active-user check.
router.post("/", requireAuth, ClientErrorController.create);
router.get("/", requireAuth, requireActiveUser, requireAdmin, ClientErrorController.list);

export default router;
