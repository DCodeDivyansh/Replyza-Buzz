import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  convertCuelinksController,
  deleteCuelinksController,
  getCuelinksController,
  upsertCuelinksController,
} from "../controllers/cuelinks.controller";

const router = Router();

router.use(authenticate);

router.get("/", getCuelinksController);
router.put("/", upsertCuelinksController);
router.delete("/", deleteCuelinksController);
router.post("/convert", convertCuelinksController);

export default router;
