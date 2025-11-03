import { Router } from "express";
import { body } from "express-validator";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth";
import { authLimiter, passwordResetLimiter } from "../middleware/rateLimiter";
import { passwordResetAuth } from "../middleware/passwordResetAuth";
import { query } from "express-validator";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validate([
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
  ]),
  authController.register
);

router.post(
  "/login",
  authLimiter,
  validate([
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ]),
  authController.login
);

router.post(
  "/refresh",
  validate([
    body("refreshToken").notEmpty().withMessage("Refresh token is required"),
  ]),
  authController.refreshToken
);

router.post("/logout", authenticate, authController.logout);

router.put(
  "/profile",
  authenticate,
  validate([
    body("fullName")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters"),
    body("companyName").optional().trim(),
  ]),
  authController.updateProfile
);

router.get("/me", authenticate, authController.getCurrentUser);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate([
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
  ]),
  authController.forgotPassword
);

router.get(
  "/validate-reset-token",
  validate([query("token").notEmpty().withMessage("Reset token is required")]),
  authController.validateResetToken
);

router.post(
  "/reset-password",
  passwordResetAuth,
  passwordResetLimiter,
  validate([
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
  ]),
  authController.resetPassword
);

router.post(
  "/change-password",
  authenticate,
  validate([
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
  ]),
  authController.changePassword
);

export default router;
