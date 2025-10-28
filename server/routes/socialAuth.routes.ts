import express from "express";
import {
  initiateLinkedInAuth,
  handleLinkedInCallback,
  getUserSocialAccounts,
  disconnectSocialAccount,
  validateAndRefreshToken,
} from "../controllers/socialAuth.controller";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.get("/linkedin", initiateLinkedInAuth);
router.get("/linkedin/callback", handleLinkedInCallback);

router.get(
  "/accounts",
  validateAndRefreshToken,  
  authenticate,              
  getUserSocialAccounts   
);

router.delete(
  "/accounts/:platform",
  authenticate,              
  disconnectSocialAccount    
);

export default router;