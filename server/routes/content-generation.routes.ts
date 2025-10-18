import { Router } from 'express';
import { ContentGenerationController } from '../controllers/content-generation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Generate content from document
router.post(
  '/:workspaceId/content/generate',
  ContentGenerationController.generateContent
);

// Improve existing content
router.post(
  '/:workspaceId/content/:postId/improve',
  ContentGenerationController.improveContent
);

// Get all generated posts
router.get(
  '/:workspaceId/content/posts',
  ContentGenerationController.getAllPosts
);

// Get single post
router.get(
  '/:workspaceId/content/posts/:postId',
  ContentGenerationController.getPost
);

// Update post
router.put(
  '/:workspaceId/content/posts/:postId',
  ContentGenerationController.updatePost
);

// Delete post
router.delete(
  '/:workspaceId/content/posts/:postId',
  ContentGenerationController.deletePost
);

// Moderate post (approve/reject)
router.post(
  '/:workspaceId/content/posts/:postId/moderate',
  ContentGenerationController.moderatePost
);

export default router;
