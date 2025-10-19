/*
  # Subscription Plans and Billing Enhancement

  ## Overview
  This migration adds comprehensive subscription management features including:
  - Subscription plans with configurable features
  - API keys storage for third-party integrations
  - Billing history and invoice tracking
  - Scheduled posts processing logs
  - Analytics aggregation tables
  - Enhanced document storage metadata

  ## New Tables
  - `subscription_plans`: Define available subscription tiers
  - `plan_features`: Configurable features for each plan
  - `api_keys`: Encrypted storage for third-party API credentials
  - `billing_history`: Track all billing transactions
  - `invoices`: Store invoice records
  - `scheduled_posts_log`: Monitor scheduled post processing
  - `analytics_daily_summary`: Aggregated analytics for performance
  - `user_billing_details`: Stripe customer information

  ## Modifications
  - Update `subscriptions` table with Stripe integration fields
  - Enhance `documents` table with S3 metadata
  - Add usage tracking fields

  ## Security
  - Enable RLS on all new tables
  - Add policies for workspace-based access control
  - Encrypt sensitive API credentials
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price_monthly numeric DEFAULT 0,
  price_yearly numeric DEFAULT 0,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create plan_features table
CREATE TABLE IF NOT EXISTS plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES subscription_plans(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  feature_value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Create api_keys table for encrypted third-party credentials
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  service text NOT NULL CHECK (service IN ('aws_s3', 'google_gemini', 'linkedin', 'twitter', 'stripe')),
  key_name text NOT NULL,
  encrypted_value text NOT NULL,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, service, key_name)
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create billing_history table
CREATE TABLE IF NOT EXISTS billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id text UNIQUE,
  invoice_number text,
  amount_due numeric NOT NULL,
  amount_paid numeric DEFAULT 0,
  currency text DEFAULT 'usd',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  invoice_pdf text,
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create scheduled_posts_log table
CREATE TABLE IF NOT EXISTS scheduled_posts_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_post_id uuid REFERENCES scheduled_posts(id) ON DELETE CASCADE NOT NULL,
  attempt_number integer DEFAULT 1,
  status text NOT NULL CHECK (status IN ('processing', 'success', 'failed', 'retrying')),
  error_message text,
  response_data jsonb,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_posts_log ENABLE ROW LEVEL SECURITY;

-- Create analytics_daily_summary table
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'twitter')),
  summary_date date NOT NULL,
  total_posts integer DEFAULT 0,
  total_impressions integer DEFAULT 0,
  total_engagement integer DEFAULT 0,
  total_clicks integer DEFAULT 0,
  avg_engagement_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, platform, summary_date)
);

ALTER TABLE analytics_daily_summary ENABLE ROW LEVEL SECURITY;

-- Create user_billing_details table
CREATE TABLE IF NOT EXISTS user_billing_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id text UNIQUE,
  payment_method_id text,
  card_brand text,
  card_last4 text,
  billing_email text,
  billing_name text,
  billing_address jsonb,
  tax_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_billing_details ENABLE ROW LEVEL SECURITY;

-- Enhance subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN plan_id uuid REFERENCES subscription_plans(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_ends_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'usage_current_period'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN usage_current_period jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Enhance documents table for S3 integration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 's3_bucket'
  ) THEN
    ALTER TABLE documents ADD COLUMN s3_bucket text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 's3_key'
  ) THEN
    ALTER TABLE documents ADD COLUMN s3_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 's3_region'
  ) THEN
    ALTER TABLE documents ADD COLUMN s3_region text DEFAULT 'us-east-1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'processing_metadata'
  ) THEN
    ALTER TABLE documents ADD COLUMN processing_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE documents ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, sort_order)
VALUES
  ('free', 'Free', 'Perfect for trying out the platform', 0, 0, 1),
  ('starter', 'Starter', 'Great for individuals and small teams', 29, 290, 2),
  ('pro', 'Pro', 'For growing businesses', 79, 790, 3),
  ('enterprise', 'Enterprise', 'Custom solutions for large organizations', 299, 2990, 4)
ON CONFLICT (name) DO NOTHING;

-- Insert plan features
DO $$
DECLARE
  free_plan_id uuid;
  starter_plan_id uuid;
  pro_plan_id uuid;
  enterprise_plan_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'free';
  SELECT id INTO starter_plan_id FROM subscription_plans WHERE name = 'starter';
  SELECT id INTO pro_plan_id FROM subscription_plans WHERE name = 'pro';
  SELECT id INTO enterprise_plan_id FROM subscription_plans WHERE name = 'enterprise';

  -- Free plan features
  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (free_plan_id, 'posts_per_day', '1'::jsonb),
    (free_plan_id, 'posts_per_month', '30'::jsonb),
    (free_plan_id, 'ai_generations_per_month', '50'::jsonb),
    (free_plan_id, 'scheduling_enabled', 'false'::jsonb),
    (free_plan_id, 'image_attachments', 'false'::jsonb),
    (free_plan_id, 'analytics_access', 'false'::jsonb),
    (free_plan_id, 'platforms', '["linkedin", "twitter"]'::jsonb),
    (free_plan_id, 'team_members', '1'::jsonb)
  ON CONFLICT (plan_id, feature_key) DO NOTHING;

  -- Starter plan features
  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (starter_plan_id, 'posts_per_day', '5'::jsonb),
    (starter_plan_id, 'posts_per_month', '150'::jsonb),
    (starter_plan_id, 'ai_generations_per_month', '200'::jsonb),
    (starter_plan_id, 'scheduling_enabled', 'true'::jsonb),
    (starter_plan_id, 'image_attachments', 'true'::jsonb),
    (starter_plan_id, 'analytics_access', 'true'::jsonb),
    (starter_plan_id, 'platforms', '["linkedin", "twitter"]'::jsonb),
    (starter_plan_id, 'team_members', '3'::jsonb)
  ON CONFLICT (plan_id, feature_key) DO NOTHING;

  -- Pro plan features
  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (pro_plan_id, 'posts_per_day', '20'::jsonb),
    (pro_plan_id, 'posts_per_month', '600'::jsonb),
    (pro_plan_id, 'ai_generations_per_month', '1000'::jsonb),
    (pro_plan_id, 'scheduling_enabled', 'true'::jsonb),
    (pro_plan_id, 'image_attachments', 'true'::jsonb),
    (pro_plan_id, 'analytics_access', 'true'::jsonb),
    (pro_plan_id, 'platforms', '["linkedin", "twitter"]'::jsonb),
    (pro_plan_id, 'team_members', '10'::jsonb)
  ON CONFLICT (plan_id, feature_key) DO NOTHING;

  -- Enterprise plan features
  INSERT INTO plan_features (plan_id, feature_key, feature_value) VALUES
    (enterprise_plan_id, 'posts_per_day', 'unlimited'::jsonb),
    (enterprise_plan_id, 'posts_per_month', 'unlimited'::jsonb),
    (enterprise_plan_id, 'ai_generations_per_month', 'unlimited'::jsonb),
    (enterprise_plan_id, 'scheduling_enabled', 'true'::jsonb),
    (enterprise_plan_id, 'image_attachments', 'true'::jsonb),
    (enterprise_plan_id, 'analytics_access', 'true'::jsonb),
    (enterprise_plan_id, 'platforms', '["linkedin", "twitter"]'::jsonb),
    (enterprise_plan_id, 'team_members', 'unlimited'::jsonb)
  ON CONFLICT (plan_id, feature_key) DO NOTHING;
END $$;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for plan_features (public read)
CREATE POLICY "Anyone can view plan features"
  ON plan_features FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for api_keys
CREATE POLICY "Workspace owners can view API keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can manage API keys"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for billing_history
CREATE POLICY "Workspace owners can view billing history"
  ON billing_history FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Workspace owners can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for scheduled_posts_log
CREATE POLICY "Workspace members can view post logs"
  ON scheduled_posts_log FOR SELECT
  TO authenticated
  USING (
    scheduled_post_id IN (
      SELECT sp.id FROM scheduled_posts sp
      WHERE sp.workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
        UNION
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for analytics_daily_summary
CREATE POLICY "Workspace members can view analytics summary"
  ON analytics_daily_summary FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for user_billing_details
CREATE POLICY "Workspace owners can view billing details"
  ON user_billing_details FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can manage billing details"
  ON user_billing_details FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON subscription_plans(name);
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
CREATE INDEX IF NOT EXISTS idx_billing_history_workspace_id ON billing_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_id ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_log_scheduled_post_id ON scheduled_posts_log(scheduled_post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_workspace_id ON analytics_daily_summary(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_user_billing_details_workspace_id ON user_billing_details(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_details_stripe_customer_id ON user_billing_details(stripe_customer_id);
