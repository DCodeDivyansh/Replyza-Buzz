import type { RequestHandler } from "express";
import {
  fetchInstagramAccountMedia,
  InstagramMediaError,
} from "../services/instagram-media.service";

export const getInstagramAccountMedia: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const accountId = req.params.id as string;
    const after = typeof req.query.after === "string" ? req.query.after : undefined;

    const media = await fetchInstagramAccountMedia(userId, accountId, after);

    res.status(200).json({
      success: true,
      data: media.data,
      paging: media.paging,
    });
  } catch (error) {
    if (error instanceof InstagramMediaError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }
    next(error);
  }
};
