// routes/socialAuth.routes.ts
import express from "express";
import {
  initiateLinkedInAuth,
  handleLinkedInCallback,
  getUserSocialAccounts,
  disconnectSocialAccount,
} from "../controllers/socialAuth.controller";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// ✅ NO middleware on LinkedIn route
router.get("/linkedin", initiateLinkedInAuth);
router.get("/linkedin/callback", handleLinkedInCallback);

// With auth on these
router.get("/accounts", authenticate, getUserSocialAccounts);
router.delete("/accounts/:platform", authenticate, disconnectSocialAccount);

export default router;