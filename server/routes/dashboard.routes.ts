import { Router } from 'express';
import { param, query } from 'express-validator';
import * as dashboardController from '../controllers/dashboard.controller';
import { validate } from '../middleware/validation';
import { authenticate, requireWorkspace } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get(
  '/:workspaceId/stats',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  dashboardController.getDashboardStats
);

router.get(
  '/:workspaceId/activity',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ]),
  requireWorkspace,
  dashboardController.getRecentActivity
);

router.get(
  '/:workspaceId/analytics',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  dashboardController.getAnalytics
);

export default router;
