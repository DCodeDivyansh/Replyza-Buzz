import type { RequestHandler } from "express";
import { z } from "zod";
import {
  listTemplates,
  getTemplateById,
  createCustomTemplate,
  deleteCustomTemplate,
} from "../services/template.service";
import { isValidUuid } from "../utils/uuid";

const createTemplateValidator = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(50).optional(),
  description: z.string().trim().max(500).optional(),
  triggerType: z.enum(["ANY_COMMENT", "KEYWORD"]),
  keywords: z.array(z.string().trim().min(1).max(50)).default([]),
  publicReplyText: z.string().trim().min(1).max(500),
  dmMessageText: z.string().trim().min(1).max(2000),
  dmLink: z.string().url().optional(),
  followRequired: z.boolean().default(false),
  followInstructionText: z.string().trim().max(1000).optional(),
  followSuccessText: z.string().trim().max(1000).optional(),
  followFallbackText: z.string().trim().max(1000).optional(),
});

export const getTemplatesController: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const templates = await listTemplates(userId);

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

export const getTemplateByIdController: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id as string;
    if (!isValidUuid(templateId)) {
      res.status(400).json({
        success: false,
        message: "Invalid template ID format",
      });
      return;
    }
    const template = await getTemplateById(userId, templateId);

    if (!template) {
      res.status(404).json({
        success: false,
        message: "Template not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

export const createTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const parsed = createTemplateValidator.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid template input",
        errors: parsed.error.issues,
      });
      return;
    }

    const template = await createCustomTemplate(userId, parsed.data);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id as string;

    if (!isValidUuid(templateId)) {
      res.status(400).json({
        success: false,
        message: "Invalid template ID format",
      });
      return;
    }

    const deleted = await deleteCustomTemplate(userId, templateId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Template not found or cannot delete system template",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
