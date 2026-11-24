import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getTemplatesController,
  getTemplateByIdController,
  createTemplateController,
  deleteTemplateController,
} from "../controllers/template.controller";

const router = Router();

router.use(authenticate);

router.get("/", getTemplatesController);
router.post("/", createTemplateController);
router.get("/:id", getTemplateByIdController);
router.delete("/:id", deleteTemplateController);

export default router;
