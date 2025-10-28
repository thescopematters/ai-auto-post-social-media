import express from 'express';
import { schedulePostController } from '../controllers/schedulePost.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get(
  '/workspaces/:workspaceId/scheduled-posts',
  authenticate,
  schedulePostController.getScheduledPosts
);

router.post(
  '/workspaces/:workspaceId/schedule',
  authenticate,
  schedulePostController.schedulePost
);

router.patch(
  '/workspaces/:workspaceId/scheduled-posts/:postId',
  authenticate,
  schedulePostController.updateScheduledPost
);

router.delete(
  '/workspaces/:workspaceId/scheduled-posts/:postId',
  authenticate,
  schedulePostController.deleteScheduledPost
);

router.post(
  '/publish-now',
  authenticate,
  schedulePostController.publishNow
);

export default router;