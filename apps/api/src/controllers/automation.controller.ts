
import type { RequestHandler } from "express";
import {
  AutomationError,
  createAutomation,
  getUserAutomations,
  getAutomationById,
  updateAutomation,
  updateAutomationStatus,
  deleteAutomation
} from "../services/automation.service";

import {
  createAutomationSchema,
  updateAutomationSchema,
  automationStatusSchema
} from "../validators/automation.validator";

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
