import express from "express";
import { AssistantController } from "../controllers/assistant.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/chat", requireAuth, requireActiveUser, AssistantController.chat);
router.post("/commit", requireAuth, requireActiveUser, AssistantController.commit);

export default router;
