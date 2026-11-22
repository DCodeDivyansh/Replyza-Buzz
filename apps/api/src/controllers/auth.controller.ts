
import type { Request, Response, NextFunction } from "express";
import { registerUser, AuthError } from "../services/auth.service";
import { registerSchema } from "../validators/auth.validator";

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
