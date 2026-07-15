import express from "express";
import { InstrumentController } from "../controllers/instrument.controller";
import { requireActiveUser, requireAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", requireAuth, requireActiveUser, InstrumentController.list);
router.post("/", requireAuth, requireActiveUser, InstrumentController.create);

router.post(
  "/:idInstrument/accounts",
  requireAuth,
  requireActiveUser,
  InstrumentController.createInvestmentAccount
);
router.patch(
  "/:idInstrument/accounts/:idInvestmentAccount",
  requireAuth,
  requireActiveUser,
  InstrumentController.updateInvestmentAccount
);
router.delete(
  "/:idInstrument/accounts/:idInvestmentAccount",
  requireAuth,
  requireActiveUser,
  InstrumentController.removeInvestmentAccount
);

router.patch("/:idInstrument", requireAuth, requireActiveUser, InstrumentController.update);
router.delete("/:idInstrument", requireAuth, requireActiveUser, InstrumentController.remove);

export default router;
