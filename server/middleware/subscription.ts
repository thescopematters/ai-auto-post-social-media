import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import supabaseAdmin from '../config/database';
import { ForbiddenError } from '../utils/errors';
import logger from '../config/logger';

interface PlanFeatures {
  posts_per_day: number | string;
  posts_per_month: number | string;
  ai_generations_per_month: number | string;
  scheduling_enabled: boolean;
  image_attachments: boolean;
  analytics_access: boolean;
  platforms: string[];
  team_members: number | string;
}

export const checkSubscriptionFeature = (featureKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        throw new ForbiddenError('Workspace ID required');
      }

      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('workspace_id', workspaceId)
        .single();

      if (!subscription || (subscription as any).status !== 'active') {
        throw new ForbiddenError('Active subscription required');
      }

      const { data: features } = await supabaseAdmin
        .from('plan_features')
        .select('*')
        .eq('plan_id', (subscription as any).plan_id);

      const planFeatures: any = {};
      features?.forEach((f: any) => {
        planFeatures[f.feature_key] = f.feature_value;
      });

      const featureValue = planFeatures[featureKey];

      if (featureValue === false || featureValue === 'false') {
        throw new ForbiddenError(`This feature requires a plan upgrade`);
      }

      (req as any).subscription = subscription;
      (req as any).planFeatures = planFeatures;

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const checkUsageLimit = (limitType: 'posts_per_day' | 'posts_per_month' | 'ai_generations_per_month') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        throw new ForbiddenError('Workspace ID required');
      }

      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('workspace_id', workspaceId)
        .single();

      if (!subscription) {
        throw new ForbiddenError('Subscription required');
      }

      const { data: features } = await supabaseAdmin
        .from('plan_features')
        .select('*')
        .eq('plan_id', (subscription as any).plan_id)
        .eq('feature_key', limitType)
        .single();

      const limit = (features as any)?.feature_value;

      if (limit === 'unlimited' || limit === '"unlimited"') {
        return next();
      }

      const limitValue = typeof limit === 'string' ? parseInt(limit) : limit;

      const usageCurrent = (subscription as any).usage_current_period || {};
      const currentUsage = usageCurrent[limitType] || 0;

      if (currentUsage >= limitValue) {
        throw new ForbiddenError(`${limitType} limit reached. Please upgrade your plan.`);
      }

      (req as any).subscription = subscription;
      (req as any).currentUsage = currentUsage;
      (req as any).usageLimit = limitValue;

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const trackUsage = (usageType: 'posts_per_day' | 'posts_per_month' | 'ai_generations_per_month') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId || !(req as any).subscription) {
        return next();
      }

      const usageCurrent = (req as any).subscription.usage_current_period || {};
      usageCurrent[usageType] = (usageCurrent[usageType] || 0) + 1;

      await supabaseAdmin
        .from('subscriptions')
        .update({ usage_current_period: usageCurrent } as never)
        .eq('workspace_id', workspaceId);

      logger.info(`Usage tracked: ${usageType} for workspace ${workspaceId}`);

      next();
    } catch (error) {
      logger.error('Usage tracking error:', error);
      next();
    }
  };
};

export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      throw new ForbiddenError('Workspace ID required');
    }

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('workspace_id', workspaceId)
      .single();

    if (!subscription) {
      throw new ForbiddenError('Subscription required');
    }

    const status = (subscription as any).status;
    if (status !== 'active' && status !== 'trialing') {
      throw new ForbiddenError('Active subscription required. Please update your billing information.');
    }

    const now = new Date();
    const currentPeriodEnd = new Date((subscription as any).current_period_end);

    if (now > currentPeriodEnd) {
      throw new ForbiddenError('Subscription expired. Please renew your subscription.');
    }

    (req as any).subscription = subscription;

    next();
  } catch (error) {
    next(error);
  }
};

declare global {
  namespace Express {
    interface Request {
      subscription?: any;
      planFeatures?: PlanFeatures;
      currentUsage?: number;
      usageLimit?: number;
    }
  }
}
