import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  listInstagramAccounts,
  deleteInstagramAccount,
  subscribeAccount,
} from "../controllers/instagram-account.controller";

const router = Router();

router.use(authenticate);

router.get("/accounts", listInstagramAccounts);
router.delete("/accounts/:id", deleteInstagramAccount);
router.post("/accounts/:id/subscribe", subscribeAccount);

export default router;
