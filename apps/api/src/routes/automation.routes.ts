import { Router } from "express";

import {
  createAutomationController,
  listAutomationsController,
  getAutomationController,
  updateAutomationController,
  updateAutomationStatusController,
  deleteAutomationController,
  listExecutionsController,
  getExecutionController,
} from "../controllers/automation.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All automation routes require authentication.
router.use(authenticate);

// Execution history endpoints (must precede /:id)
router.get("/executions", listExecutionsController);
router.get("/executions/:executionId", getExecutionController);

router.post("/", createAutomationController);
router.get("/", listAutomationsController);
router.get("/:id", getAutomationController);
router.get("/:id/executions", listExecutionsController);
router.patch("/:id", updateAutomationController);
router.patch("/:id/status", updateAutomationStatusController);
router.delete("/:id", deleteAutomationController);

export default router;