
import type { Request, Response, NextFunction } from "express";
import { registerUser, AuthError, loginUser, refreshUserSession, } from "../services/auth.service";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import { prisma } from "@replyza/database";
import { refreshCookieOptions } from "../config/cookie.config";

export async function register(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // 1. Validate incoming request data.
        const validation = registerSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
            return;
        }

        // 2. Register the user.
        const user = await registerUser(validation.data);

        // 3. Send the response.
        res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: { user }
        });
    } catch (error) {
        if (error instanceof AuthError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
            return;
        }

        next(error);
    }
}


export async function login(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // 1. Validate login request.
        const validation = loginSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
            return;
        }

        // 2. Authenticate user and generate access token.
        const result = await loginUser(validation.data);

        // 3. Return token and safe user details.
        const { refreshToken, ...responseData } = result;

        res.cookie(
            "replyza_refresh",
            refreshToken,
            refreshCookieOptions
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: responseData
        });
    } catch (error) {
        if (error instanceof AuthError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
            return;
        }

        next(error);
    }
}

export async function getCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user!.id
            },
            select: {
                id: true,
                email: true,
                createdAt: true
            }
        });

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (error) {
        next(error);
    }
}


export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Read refresh token from HttpOnly cookie.
    const refreshToken = req.cookies?.replyza_refresh;

    if (
      typeof refreshToken !== "string" ||
      refreshToken.length === 0
    ) {
      res.status(401).json({
        success: false,
        message: "Refresh token required"
      });
      return;
    }

    // 2. Rotate refresh token and generate new access token.
    const result = await refreshUserSession(refreshToken);

    // 3. Replace the old cookie with the new refresh token.
    res.cookie(
      "replyza_refresh",
      result.refreshToken,
      refreshCookieOptions
    );

    // 4. Return only the new access token.
    res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      data: {
        accessToken: result.accessToken
      }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.clearCookie("replyza_refresh", {
        ...refreshCookieOptions,
        maxAge: undefined
      });

      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    next(error);
  }
}
