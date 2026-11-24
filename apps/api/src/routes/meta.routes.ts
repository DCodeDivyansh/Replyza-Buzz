import { Router } from "express";
import express from "express";
import { handleMetaDataDeletion } from "../controllers/meta-data-deletion.controller";

const router = Router();

// Meta sends data deletion POST as either application/x-www-form-urlencoded or application/json
router.post(
  "/data-deletion",
  express.urlencoded({ extended: true }),
  express.json(),
  handleMetaDataDeletion
);

export default router;
