// routes/scheduler.routes.ts
import express from 'express';
import { schedulerController } from '../controllers/scheduler.controller';

const router = express.Router();

// Manual trigger route for testing
router.post('/publish-now', schedulerController.manualPublish);

export default router;