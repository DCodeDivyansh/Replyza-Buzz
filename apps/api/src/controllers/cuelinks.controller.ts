import type { RequestHandler } from "express";
import {
  CuelinksError,
  convertToCuelinksUrl,
  deleteCuelinksIntegration,
  getCuelinksIntegration,
  upsertCuelinksIntegration,
} from "../services/cuelinks.service";
import {
  convertCuelinksSchema,
  upsertCuelinksSchema,
} from "../validators/cuelinks.validator";

export const getCuelinksController: RequestHandler = async (req, res, next) => {
  try {
    const status = await getCuelinksIntegration(req.user!.id);
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

export const upsertCuelinksController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const parsed = upsertCuelinksSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid Cuelinks settings",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const updated = await upsertCuelinksIntegration(req.user!.id, parsed.data);
    res.status(200).json({
      success: true,
      message: "Cuelinks integration saved",
      data: updated,
    });
  } catch (error) {
    if (error instanceof CuelinksError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const deleteCuelinksController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const result = await deleteCuelinksIntegration(req.user!.id);
    res.status(200).json({
      success: true,
      message: "Cuelinks integration disconnected",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const convertCuelinksController: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const parsed = convertCuelinksSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid URL",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const result = await convertToCuelinksUrl(req.user!.id, parsed.data);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof CuelinksError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};
