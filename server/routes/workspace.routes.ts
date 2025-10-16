import { Router } from 'express';
import { body, param } from 'express-validator';
import * as workspaceController from '../controllers/workspace.controller';
import { validate } from '../middleware/validation';
import { authenticate, requireWorkspace, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', workspaceController.getAllWorkspaces);

router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Workspace name is required'),
    body('brandColor').optional().isHexColor().withMessage('Invalid color format'),
  ]),
  workspaceController.createWorkspace
);

router.get(
  '/:workspaceId',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  workspaceController.getWorkspaceById
);

router.put(
  '/:workspaceId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    body('name').optional().trim().notEmpty().withMessage('Workspace name cannot be empty'),
    body('brandColor').optional().isHexColor().withMessage('Invalid color format'),
  ]),
  requireWorkspace,
  requireRole(['admin']),
  workspaceController.updateWorkspace
);

router.delete(
  '/:workspaceId',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  requireRole(['admin']),
  workspaceController.deleteWorkspace
);

router.get(
  '/:workspaceId/members',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  workspaceController.getWorkspaceMembers
);

router.post(
  '/:workspaceId/members',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('role').isIn(['admin', 'editor', 'viewer']).withMessage('Invalid role'),
  ]),
  requireWorkspace,
  requireRole(['admin']),
  workspaceController.addWorkspaceMember
);

router.put(
  '/:workspaceId/members/:memberId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('memberId').isUUID().withMessage('Invalid member ID'),
    body('role').isIn(['admin', 'editor', 'viewer']).withMessage('Invalid role'),
  ]),
  requireWorkspace,
  requireRole(['admin']),
  workspaceController.updateWorkspaceMember
);

router.delete(
  '/:workspaceId/members/:memberId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('memberId').isUUID().withMessage('Invalid member ID'),
  ]),
  requireWorkspace,
  requireRole(['admin']),
  workspaceController.removeWorkspaceMember
);

export default router;
