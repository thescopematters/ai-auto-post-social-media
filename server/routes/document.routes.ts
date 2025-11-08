import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as documentController from '../controllers/document.controller';
import { validate } from '../middleware/validation';
import { authenticate, requireWorkspace, requireRole } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate);

router.get(
  '/:workspaceId/documents/upload-limits',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  documentController.checkDocumentUploadLimits
);

router.get(
  '/:workspaceId/documents',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ]),
  requireWorkspace,
  documentController.getAllDocuments
);

router.get(
  '/:workspaceId/documents/stats',
  validate([param('workspaceId').isUUID().withMessage('Invalid workspace ID')]),
  requireWorkspace,
  documentController.getDocumentStats
);

router.get(
  '/:workspaceId/documents/:documentId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('documentId').isUUID().withMessage('Invalid document ID'),
  ]),
  requireWorkspace,
  documentController.getDocumentById
);

router.post(
  '/:workspaceId/documents',
  uploadLimiter,
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('fileType').isIn(['pdf', 'docx', 'txt', 'url', 'manual']).withMessage('Invalid file type'),
    body('fileUrl').optional().isURL().withMessage('Invalid URL'),
    body('contentText').optional().isString(),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  documentController.createDocument
);

router.put(
  '/:workspaceId/documents/:documentId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('documentId').isUUID().withMessage('Invalid document ID'),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('contentText').optional().isString(),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  documentController.updateDocument
);

router.delete(
  '/:workspaceId/documents/:documentId',
  validate([
    param('workspaceId').isUUID().withMessage('Invalid workspace ID'),
    param('documentId').isUUID().withMessage('Invalid document ID'),
  ]),
  requireWorkspace,
  requireRole(['admin', 'editor']),
  documentController.deleteDocument
);

export default router;