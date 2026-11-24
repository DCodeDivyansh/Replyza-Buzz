import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  listInstagramAccounts,
  deleteInstagramAccount,
  subscribeAccount,
} from "../controllers/instagram-account.controller";
import { getInstagramAccountMedia } from "../controllers/instagram-media.controller";

const router = Router();

router.use(authenticate);

router.get("/accounts", listInstagramAccounts);
router.get("/accounts/:id/media", getInstagramAccountMedia);
router.delete("/accounts/:id", deleteInstagramAccount);
router.post("/accounts/:id/subscribe", subscribeAccount);

export default router;
