
import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(254, "Email address is too long")
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(128, "Password must not exceed 128 characters"),

  confirmPassword: z
    .string()
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  }
);

export type RegisterInput = z.infer<typeof registerSchema>;
