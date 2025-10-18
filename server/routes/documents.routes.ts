import { Router } from 'express';
import multer from 'multer';
import { DocumentsController } from '../controllers/documents.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// All routes require authentication
router.use(authenticate);

// Upload file
router.post(
  '/:workspaceId/documents/upload',
  upload.single('file'),
  DocumentsController.uploadFile
);

// Upload from URL
router.post(
  '/:workspaceId/documents/from-url',
  DocumentsController.uploadFromUrl
);

// Upload from text
router.post(
  '/:workspaceId/documents/from-text',
  DocumentsController.uploadFromText
);

// Get all documents
router.get(
  '/:workspaceId/documents',
  DocumentsController.getDocuments
);

// Get document stats
router.get(
  '/:workspaceId/documents/stats',
  DocumentsController.getDocumentStats
);

// Get single document
router.get(
  '/:workspaceId/documents/:documentId',
  DocumentsController.getDocument
);

// Update document
router.put(
  '/:workspaceId/documents/:documentId',
  DocumentsController.updateDocument
);

// Delete document
router.delete(
  '/:workspaceId/documents/:documentId',
  DocumentsController.deleteDocument
);

export default router;
