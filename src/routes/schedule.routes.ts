import express from "express";
import { ScheduleController } from "../controllers/schedule.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// Static "/occurrences..." routes registered before the dynamic "/:idSchedule"
// routes, same ordering gotcha as wallets'/categories' "/reorder".
router.get("/occurrences", requireAuth, requireActiveUser, ScheduleController.listOccurrences);
router.post("/occurrences/:idOccurrence/pay", requireAuth, requireActiveUser, ScheduleController.payOccurrence);
router.post("/occurrences/:idOccurrence/cancel", requireAuth, requireActiveUser, ScheduleController.cancelOccurrence);

router.get("/", requireAuth, requireActiveUser, ScheduleController.list);
router.post("/", requireAuth, requireActiveUser, ScheduleController.create);
router.patch("/:idSchedule/pause", requireAuth, requireActiveUser, ScheduleController.setActive);
router.patch("/:idSchedule", requireAuth, requireActiveUser, ScheduleController.update);
router.delete("/:idSchedule", requireAuth, requireActiveUser, ScheduleController.remove);

export default router;
