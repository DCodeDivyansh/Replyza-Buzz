import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
  refresh
} from "../controllers/auth.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authenticate, getCurrentUser);

export default router;