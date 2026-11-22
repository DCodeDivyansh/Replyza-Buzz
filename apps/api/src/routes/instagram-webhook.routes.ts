import { Router } from "express";

import {
  verifyInstagramWebhook,
  receiveInstagramWebhook
} from "../controllers/instagram-webhook.controller";

const router = Router();

router.get("/instagram", verifyInstagramWebhook);
router.post("/instagram", receiveInstagramWebhook);

export default router;