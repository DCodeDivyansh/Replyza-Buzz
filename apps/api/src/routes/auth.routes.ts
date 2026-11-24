
import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
  refresh,
  logout,
  deleteAccount
} from "../controllers/auth.controller";

import { authenticate } from "../middleware/auth.middleware";
import { csrfProtection } from "../middleware/csrf.middleware";

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
  csrfProtection,
  refresh
);

// Logout.
router.post(
  "/logout",
  authRateLimiter,
  csrfProtection,
  logout
);

// Current authenticated user.
router.get(
  "/me",
  authenticate,
  getCurrentUser
);

// Delete account and all associated data.
router.post(
  "/delete-account",
  authenticate,
  csrfProtection,
  deleteAccount
);

export default router;
