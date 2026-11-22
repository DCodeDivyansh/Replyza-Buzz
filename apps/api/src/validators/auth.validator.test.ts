
import { registerSchema } from "./auth.validator";

const testData = {
  email: " TEST@EXAMPLE.COM ",
  password: "StrongPassword123!",
  confirmPassword: "StrongPassword123!"
};

const result = registerSchema.safeParse(testData);

if (result.success) {
  console.log("Validation passed:", result.data);
} else {
  console.log("Validation failed:", result.error.issues);
}
