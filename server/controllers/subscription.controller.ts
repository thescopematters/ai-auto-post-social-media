import { Request, Response } from 'express';
import { StripeService } from '../services/stripe.service';
import supabaseAdmin from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export class SubscriptionController {
  static async getPlans(req: Request, res: Response) {
    try {
      const { data: plans, error } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      return successResponse(res, plans, 'Subscription plans retrieved successfully');
    } catch (error) {
      console.error('Get plans error:', error);
      return errorResponse(res, 'Failed to retrieve subscription plans', 500);
    }
  }

  static async getCurrentSubscription(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;

      const { data: subscription, error } = await (supabaseAdmin as any)
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return successResponse(
        res,
        subscription || null,
        subscription ? 'Subscription retrieved successfully' : 'No active subscription'
      );
    } catch (error) {
      console.error('Get subscription error:', error);
      return errorResponse(res, 'Failed to retrieve subscription', 500);
    }
  }

  static async createSubscription(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { planName, billingCycle = 'monthly', paymentMethodId } = req.body;

      if (!planName || !paymentMethodId) {
        return errorResponse(res, 'Plan name and payment method are required', 400);
      }

      // Get plan details
      const { data: plan, error: planError } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('name', planName)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        return errorResponse(res, 'Subscription plan not found', 404);
      }

      // Get workspace owner email
      const { data: workspace, error: workspaceError } = await (supabaseAdmin as any)
        .from('workspaces')
        .select('owner_id, profiles(email, full_name)')
        .eq('id', workspaceId)
        .single();

      if (workspaceError || !workspace) {
        return errorResponse(res, 'Workspace not found', 404);
      }

      const priceId = billingCycle === 'monthly'
        ? (plan as any).stripe_price_id_monthly
        : (plan as any).stripe_price_id_yearly;

      if (!priceId) {
        return errorResponse(res, 'Stripe price ID not configured for this plan', 500);
      }

      // Check if customer exists in Stripe
      let { data: existingSub } = await (supabaseAdmin as any)
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('workspace_id', workspaceId)
        .single();

      let customerId = existingSub?.stripe_customer_id;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await StripeService.createCustomer(
          workspace.profiles.email,
          workspace.profiles.full_name || workspace.profiles.email,
          { workspaceId }
        );
        customerId = customer.id;
      }

      // Attach payment method
      await StripeService.attachPaymentMethod(customerId, paymentMethodId);
      await StripeService.setDefaultPaymentMethod(customerId, paymentMethodId);

      // Create Stripe subscription
      const stripeSubscription = await StripeService.createSubscription(
        customerId,
        priceId,
        { workspaceId, planName }
      );

      // Store subscription in database
      const { data: subscription, error: subError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .upsert({
          workspace_id: workspaceId,
          tier: planName.toLowerCase(),
          status: stripeSubscription.status,
          billing_cycle: billingCycle,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscription.id,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          usage_limits: (plan as any).features,
        })
        .select()
        .single();

      if (subError) {
        throw subError;
      }

      return successResponse(res, subscription, 'Subscription created successfully');
    } catch (error) {
      console.error('Create subscription error:', error);
      return errorResponse(
        res,
        error instanceof Error ? error.message : 'Failed to create subscription',
        500
      );
    }
  }

  static async updateSubscription(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { planName, billingCycle = 'monthly' } = req.body;

      if (!planName) {
        return errorResponse(res, 'Plan name is required', 400);
      }

      // Get current subscription
      const { data: currentSub, error: subError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single();

      if (subError || !currentSub || !currentSub.stripe_subscription_id) {
        return errorResponse(res, 'No active subscription found', 404);
      }

      // Get new plan details
      const { data: plan, error: planError } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('name', planName)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        return errorResponse(res, 'Subscription plan not found', 404);
      }

      const priceId = billingCycle === 'monthly'
        ? (plan as any).stripe_price_id_monthly
        : (plan as any).stripe_price_id_yearly;

      if (!priceId) {
        return errorResponse(res, 'Stripe price ID not configured for this plan', 500);
      }

      // Update Stripe subscription
      const stripeSubscription = await StripeService.updateSubscription(
        currentSub.stripe_subscription_id,
        priceId
      );

      // Update database
      const { data: subscription, error: updateError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .update({
          tier: planName.toLowerCase(),
          billing_cycle: billingCycle,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          usage_limits: (plan as any).features,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return successResponse(res, subscription, 'Subscription updated successfully');
    } catch (error) {
      console.error('Update subscription error:', error);
      return errorResponse(res, 'Failed to update subscription', 500);
    }
  }

  static async cancelSubscription(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { immediately = false } = req.body;

      // Get current subscription
      const { data: currentSub, error: subError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single();

      if (subError || !currentSub || !currentSub.stripe_subscription_id) {
        return errorResponse(res, 'No active subscription found', 404);
      }

      // Cancel in Stripe
      await StripeService.cancelSubscription(
        currentSub.stripe_subscription_id,
        immediately
      );

      // Update database
      const updates: any = {
        cancel_at_period_end: !immediately,
        updated_at: new Date().toISOString(),
      };

      if (immediately) {
        updates.status = 'cancelled';
      }

      const { data: subscription, error: updateError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .update(updates)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return successResponse(
        res,
        subscription,
        immediately ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at period end'
      );
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return errorResponse(res, 'Failed to cancel subscription', 500);
    }
  }

  static async resumeSubscription(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;

      // Get current subscription
      const { data: currentSub, error: subError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('workspace_id', workspaceId)
        .single();

      if (subError || !currentSub || !currentSub.stripe_subscription_id) {
        return errorResponse(res, 'No subscription found', 404);
      }

      // Resume in Stripe
      await StripeService.resumeSubscription(currentSub.stripe_subscription_id);

      // Update database
      const { data: subscription, error: updateError } = await (supabaseAdmin as any)
        .from('subscriptions')
        .update({
          cancel_at_period_end: false,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return successResponse(res, subscription, 'Subscription resumed successfully');
    } catch (error) {
      console.error('Resume subscription error:', error);
      return errorResponse(res, 'Failed to resume subscription', 500);
    }
  }
}
