import rateLimit from "express-rate-limit";
import config from "../config/environment";

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many authentication attempts, please try again after 15 minutes.",
  skipSuccessfulRequests: true,
  standardHeaders: true,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message:
      "Too many password reset attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    const email = req.body?.email || "unknown";
    return `${req.ip}-${email}`;
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many upload requests, please try again after an hour.",
});
