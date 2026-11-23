
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { startInstagramOAuth } from "../controllers/instagram-oauth.controller";
import { instagramOAuthCallback } from "../controllers/instagram-oauth-callback.controller";
import { instagramOAuthTestPage } from "../controllers/instagram-oauth-test.controller";

const router = Router();

router.get("/start", authenticate, startInstagramOAuth);
router.get("/test", instagramOAuthTestPage);
router.post("/callback", instagramOAuthCallback);

export default router;
