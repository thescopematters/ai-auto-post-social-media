// socialAuth.routes.ts
import express from 'express';
import {
  initiateLinkedInAuth,
  handleLinkedInCallback,
  getUserSocialAccounts,
  disconnectSocialAccount
} from '../controllers/socialAuth.controller';
import { authenticate } from '../middleware/auth'; // Your auth middleware

const router = express.Router();

// LinkedIn OAuth routes
router.get('/linkedin', initiateLinkedInAuth);
router.get('/linkedin/callback', handleLinkedInCallback);

// Social accounts management (protected routes)
router.get('/accounts', authenticate, getUserSocialAccounts);
router.delete('/accounts/:platform', authenticate, disconnectSocialAccount);

export default router;