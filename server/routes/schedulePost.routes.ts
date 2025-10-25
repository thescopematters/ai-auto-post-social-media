// routes/schedulePost.routes.ts
import express from 'express';
import { schedulePostController } from '../controllers/schedulePost.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Routes - Clean and focused only on routing
router.get('/workspaces/:workspaceId/scheduled-posts', authenticate, schedulePostController.getScheduledPosts);
router.post('/workspaces/:workspaceId/schedule', authenticate, schedulePostController.schedulePost);
router.delete('/workspaces/:workspaceId/schedule/:postId', authenticate, schedulePostController.deleteScheduledPost);
router.post('/publish-now', authenticate, schedulePostController.publishNow);

export default router;