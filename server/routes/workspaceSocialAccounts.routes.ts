// routes/workspaceSocialAccounts.routes.ts
import express from 'express';
import { workspaceSocialAccountsController } from '../controllers/workspaceSocialAccounts.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Workspace-specific social accounts routes
router.get('/:workspaceId/social-accounts', authenticate, workspaceSocialAccountsController.getWorkspaceSocialAccounts);
router.post('/:workspaceId/social-accounts', authenticate, workspaceSocialAccountsController.connectWorkspaceAccount);
router.delete('/:workspaceId/social-accounts/:accountId', authenticate, workspaceSocialAccountsController.disconnectWorkspaceAccount);
router.put('/:workspaceId/social-accounts/:accountId', authenticate, workspaceSocialAccountsController.updateWorkspaceAccount);

export default router;