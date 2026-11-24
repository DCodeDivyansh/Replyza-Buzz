import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { startInstagramOAuth } from "../controllers/instagram-oauth.controller";
import { instagramOAuthCallback } from "../controllers/instagram-oauth-callback.controller";
import { instagramOAuthRedirectCallback } from "../controllers/instagram-oauth-redirect.controller";

const router = Router();

router.get("/start", authenticate, startInstagramOAuth);
router.get("/callback", instagramOAuthRedirectCallback);
router.post("/callback", instagramOAuthCallback);

export default router;