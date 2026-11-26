
import type { RequestHandler } from "express";
import {
  AutomationError,
  createAutomation,
  getUserAutomations,
  getAutomationById,
  updateAutomation,
  updateAutomationStatus,
  deleteAutomation,
  listUserExecutions,
  getUserExecutionById,
} from "../services/automation.service";

import {
  createAutomationSchema,
  updateAutomationSchema,
  automationStatusSchema
} from "../validators/automation.validator";
import { isValidUuid } from "../utils/uuid";

// Create automation.
export const createAutomationController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const parsed = createAutomationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid automation data",
        errors: parsed.error.flatten()
      });
      return;
    }

    const automation = await createAutomation(
      req.user!.id,
      parsed.data
    );

    res.status(201).json({
      success: true,
      message: "Automation created successfully",
      data: automation
    });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    next(error);
  }
};

// List user's automations.
export const listAutomationsController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const automations = await getUserAutomations(req.user!.id);

    res.status(200).json({
      success: true,
      data: automations
    });
  } catch (error) {
    next(error);
  }
};

// Get one automation.
export const getAutomationController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid automation ID format"
      });
      return;
    }

    const automation = await getAutomationById(
      req.user!.id,
      req.params.id as string
    );

    res.status(200).json({
      success: true,
      data: automation
    });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    next(error);
  }
};

// Update automation.
export const updateAutomationController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid automation ID format"
      });
      return;
    }

    const parsed = updateAutomationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid automation data",
        errors: parsed.error.flatten()
      });
      return;
    }

    const automation = await updateAutomation(
      req.user!.id,
      req.params.id as string,
      parsed.data
    );

    res.status(200).json({
      success: true,
      message: "Automation updated successfully",
      data: automation
    });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    next(error);
  }
};

// Activate or pause automation.
export const updateAutomationStatusController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid automation ID format"
      });
      return;
    }

    const parsed = automationStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid automation status",
        errors: parsed.error.flatten()
      });
      return;
    }

    const automation = await updateAutomationStatus(
      req.user!.id,
      req.params.id as string,
      parsed.data.status
    );

    res.status(200).json({
      success: true,
      message: "Automation status updated successfully",
      data: automation
    });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    next(error);
  }
};

// Delete automation.
export const deleteAutomationController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid automation ID format"
      });
      return;
    }

    const result = await deleteAutomation(
      req.user!.id,
      req.params.id as string
    );

    res.status(200).json({
      success: true,
      message: "Automation deleted successfully",
      data: result
    });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    next(error);
  }
};

export const listExecutionsController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const automationId =
      typeof req.query.automationId === "string"
        ? req.query.automationId
        : typeof req.params.id === "string"
          ? req.params.id
          : undefined;
    const instagramAccountId =
      typeof req.query.instagramAccountId === "string"
        ? req.query.instagramAccountId
        : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const page =
      typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : 1;
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 25;

    const result = await listUserExecutions(req.user!.id, {
      automationId,
      instagramAccountId,
      status,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 25,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getExecutionController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!isValidUuid(req.params.executionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid execution ID format",
      });
      return;
    }

    const execution = await getUserExecutionById(
      req.user!.id,
      req.params.executionId as string
    );

    res.status(200).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};
