import { Router } from "express";

import {
  createAutomationController,
  listAutomationsController,
  getAutomationController,
  updateAutomationController,
  updateAutomationStatusController,
  deleteAutomationController
} from "../controllers/automation.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All automation routes require authentication.
router.use(authenticate);

router.post("/", createAutomationController);
router.get("/", listAutomationsController);
router.get("/:id", getAutomationController);
router.patch("/:id", updateAutomationController);
router.patch("/:id/status", updateAutomationStatusController);
router.delete("/:id", deleteAutomationController);

export default router;