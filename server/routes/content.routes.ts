import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as contentController from '../controllers/content.controller';
import { validate } from '../middleware/validation';
import { authenticate, requireWorkspace, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post(
  '/:workspaceId/generate',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    body('documentId').isUUID().withMessage('Valid document ID is required'),
    body('platform').isIn(['linkedin', 'twitter']).withMessage('Invalid platform'),
    body('tone').isIn(['professional', 'casual', 'thought_leader', 'educational', 'promotional']).withMessage('Invalid tone'),
    body('variantCount').optional().isInt({ min: 1, max: 5 }).withMessage('Variant count must be between 1 and 5'),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  contentController.generateContent
);

router.get(
  '/:workspaceId/posts',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'flagged']).withMessage('Invalid status'),
    query('platform').optional().isIn(['linkedin', 'twitter']).withMessage('Invalid platform'),
  ]),
  requireWorkspace,
  contentController.getAllPosts
);

router.get(
  '/:workspaceId/posts/:postId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('postId').isUUID().withMessage('Invalid post ID'),
  ]),
  requireWorkspace,
  contentController.getPostById
);

router.put(
  '/:workspaceId/posts/:postId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('postId').isUUID().withMessage('Invalid post ID'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('hashtags').optional().isArray().withMessage('Hashtags must be an array'),
    body('mediaUrls').optional().isArray().withMessage('Media URLs must be an array'),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  contentController.updatePost
);

router.delete(
  '/:workspaceId/posts/:postId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('postId').isUUID().withMessage('Invalid post ID'),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  contentController.deletePost
);

router.post(
  '/:workspaceId/posts/:postId/moderate',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('postId').isUUID().withMessage('Invalid post ID'),
    body('action').isIn(['approve', 'reject', 'flag']).withMessage('Invalid moderation action'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  contentController.moderatePost
);

export default router;
