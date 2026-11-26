import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  bulkImportProductsController,
  createProductController,
  deleteProductController,
  duplicateProductController,
  getProductController,
  importMetadataController,
  listProductsController,
  updateProductController,
} from "../controllers/product.controller";

const router = Router();

router.use(authenticate);

router.get("/", listProductsController);
router.post("/", createProductController);
router.post("/import-metadata", importMetadataController);
router.post("/bulk", bulkImportProductsController);
router.get("/:id", getProductController);
router.patch("/:id", updateProductController);
router.post("/:id/duplicate", duplicateProductController);
router.delete("/:id", deleteProductController);

export default router;
