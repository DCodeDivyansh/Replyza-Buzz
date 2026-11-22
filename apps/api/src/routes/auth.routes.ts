
import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
  refresh,
  logout
} from "../controllers/auth.controller";

import { authenticate } from "../middleware/auth.middleware";

import {
  authRateLimiter,
  loginRateLimiter,
  registerRateLimiter
} from "../middleware/rate-limit.middleware";

const router = Router();

// Registration.
router.post(
  "/register",
  registerRateLimiter,
  register
);

// Login.
router.post(
  "/login",
  loginRateLimiter,
  login
);

// Refresh session.
router.post(
  "/refresh",
  authRateLimiter,
  refresh
);

// Logout.
router.post(
  "/logout",
  authRateLimiter,
  logout
);

// Current authenticated user.
router.get(
  "/me",
  authenticate,
  getCurrentUser
);

export default router;
