import type { RequestHandler } from "express";
import {
  bulkImportProductsSchema,
  createProductSchema,
  importMetadataSchema,
  updateProductSchema,
} from "../validators/product.validator";
import {
  bulkImportProducts,
  createProduct,
  deleteProduct,
  duplicateProduct,
  extractUrlMetadata,
  getProductById,
  listProducts,
  ProductError,
  updateProduct,
} from "../services/product.service";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function handleProductError(res: Parameters<RequestHandler>[1], err: unknown, next: Parameters<RequestHandler>[2]) {
  if (err instanceof ProductError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }
  next(err);
}

export const listProductsController: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const products = await listProducts(userId, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      brand: typeof req.query.brand === "string" ? req.query.brand : undefined,
      status:
        req.query.status === "ACTIVE" || req.query.status === "ARCHIVED"
          ? req.query.status
          : undefined,
    });

    res.status(200).json({ success: true, data: products });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const getProductController: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID" });
      return;
    }
    const product = await getProductById(req.user!.id, id);
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const createProductController: RequestHandler = async (req, res, next) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid product input",
        errors: parsed.error.issues,
      });
      return;
    }
    const product = await createProduct(req.user!.id, parsed.data);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const updateProductController: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID" });
      return;
    }
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid product update",
        errors: parsed.error.issues,
      });
      return;
    }
    const product = await updateProduct(req.user!.id, id, parsed.data);
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const duplicateProductController: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID" });
      return;
    }
    const product = await duplicateProduct(req.user!.id, id);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const deleteProductController: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ success: false, message: "Invalid product ID" });
      return;
    }
    await deleteProduct(req.user!.id, id);
    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const importMetadataController: RequestHandler = async (req, res, next) => {
  try {
    const parsed = importMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid URL",
      });
      return;
    }
    const metadata = await extractUrlMetadata(parsed.data.url);
    res.status(200).json({ success: true, data: metadata });
  } catch (err) {
    handleProductError(res, err, next);
  }
};

export const bulkImportProductsController: RequestHandler = async (req, res, next) => {
  try {
    const parsed = bulkImportProductsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid bulk import input",
        errors: parsed.error.issues,
      });
      return;
    }
    const created = await bulkImportProducts(req.user!.id, parsed.data);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    handleProductError(res, err, next);
  }
};
