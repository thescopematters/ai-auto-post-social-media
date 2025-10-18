import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public route - get available plans
router.get('/subscription-plans', SubscriptionController.getPlans);

// All other routes require authentication
router.use(authenticate);

// Get current subscription
router.get(
  '/:workspaceId/subscription',
  SubscriptionController.getCurrentSubscription
);

// Create subscription
router.post(
  '/:workspaceId/subscription',
  SubscriptionController.createSubscription
);

// Update subscription (upgrade/downgrade)
router.put(
  '/:workspaceId/subscription',
  SubscriptionController.updateSubscription
);

// Cancel subscription
router.post(
  '/:workspaceId/subscription/cancel',
  SubscriptionController.cancelSubscription
);

// Resume subscription
router.post(
  '/:workspaceId/subscription/resume',
  SubscriptionController.resumeSubscription
);

export default router;
