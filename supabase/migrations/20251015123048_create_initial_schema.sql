/*
  # Initial Schema for LinkedIn & Twitter AI Content Automation Platform

  ## Overview
  This migration creates the complete database schema for a SaaS platform that automates 
  LinkedIn and Twitter content creation from uploaded documents using AI.

  ## New Tables
  - profiles: User profile information
  - workspaces: Tenant/workspace configuration
  - workspace_members: Team members and roles
  - social_accounts: Connected social media accounts
  - ai_agent_configs: AI agent configuration profiles
  - documents: Uploaded documents and content sources
  - generated_posts: AI-generated social media posts
  - scheduled_posts: Publishing schedule and calendar
  - post_analytics: Engagement metrics and performance data
  - moderation_logs: Audit trail for content moderation
  - subscriptions: Billing and subscription management

  ## Security
  - Enable Row Level Security (RLS) on all tables
  - Add policies for workspace-based access control
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  company_name text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  brand_color text DEFAULT '#3b82f6',
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Create social_accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'twitter')),
  account_name text NOT NULL,
  account_id text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean DEFAULT true,
  connected_at timestamptz DEFAULT now(),
  last_sync timestamptz,
  UNIQUE(workspace_id, platform, account_id)
);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- Create ai_agent_configs table
CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  tone text DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'thought_leader', 'educational', 'promotional')),
  style jsonb DEFAULT '{"length": "medium", "structure": "standard"}'::jsonb,
  intent text DEFAULT 'engagement' CHECK (intent IN ('engagement', 'lead_gen', 'brand_awareness', 'education')),
  hashtag_strategy jsonb DEFAULT '{"count": 3, "custom": []}'::jsonb,
  cta_template text,
  posting_frequency jsonb DEFAULT '{"enabled": false}'::jsonb,
  platform_settings jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_agent_configs ENABLE ROW LEVEL SECURITY;

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'url', 'manual')),
  file_url text,
  file_size bigint DEFAULT 0,
  content_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error text,
  uploaded_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create generated_posts table
CREATE TABLE IF NOT EXISTS generated_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  agent_config_id uuid REFERENCES ai_agent_configs(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'twitter')),
  content text NOT NULL,
  variant_number integer DEFAULT 1,
  hashtags text[] DEFAULT ARRAY[]::text[],
  media_urls text[] DEFAULT ARRAY[]::text[],
  predicted_score numeric DEFAULT 0,
  moderation_status text DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  moderation_notes text,
  moderated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES generated_posts(id) ON DELETE CASCADE NOT NULL,
  social_account_id uuid REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
  scheduled_time timestamptz NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed', 'cancelled')),
  published_at timestamptz,
  platform_post_id text,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Create post_analytics table
CREATE TABLE IF NOT EXISTS post_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_post_id uuid REFERENCES scheduled_posts(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  clicks_count integer DEFAULT 0,
  impressions_count integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  fetched_at timestamptz DEFAULT now(),
  metrics_data jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

-- Create moderation_logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES generated_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'flagged', 'revised')),
  reason text,
  previous_status text,
  new_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tier text DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  usage_limits jsonb DEFAULT '{"posts_per_month": 10, "ai_generations": 50}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for workspaces
CREATE POLICY "Users can view workspaces they own or are members of"
  ON workspaces FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owners can update their workspaces"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owners can delete their workspaces"
  ON workspaces FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for workspace_members
CREATE POLICY "Workspace members can view membership"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can manage members"
  ON workspace_members FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for social_accounts
CREATE POLICY "Workspace members can view social accounts"
  ON social_accounts FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners and admins can manage social accounts"
  ON social_accounts FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- RLS Policies for ai_agent_configs
CREATE POLICY "Workspace members can view agent configs"
  ON ai_agent_configs FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace editors can manage agent configs"
  ON ai_agent_configs FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- RLS Policies for documents
CREATE POLICY "Workspace members can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace editors can create documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Workspace editors can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Workspace editors can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- RLS Policies for generated_posts
CREATE POLICY "Workspace members can view generated posts"
  ON generated_posts FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace editors can create posts"
  ON generated_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Workspace editors can update posts"
  ON generated_posts FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Workspace editors can delete posts"
  ON generated_posts FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- RLS Policies for scheduled_posts
CREATE POLICY "Workspace members can view scheduled posts"
  ON scheduled_posts FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace editors can manage scheduled posts"
  ON scheduled_posts FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- RLS Policies for post_analytics
CREATE POLICY "Workspace members can view analytics"
  ON post_analytics FOR SELECT
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

-- RLS Policies for moderation_logs
CREATE POLICY "Workspace members can view moderation logs"
  ON moderation_logs FOR SELECT
  TO authenticated
  USING (
    post_id IN (
      SELECT gp.id FROM generated_posts gp
      WHERE gp.workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
        UNION
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Workspace editors can create moderation logs"
  ON moderation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    post_id IN (
      SELECT gp.id FROM generated_posts gp
      WHERE gp.workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
        UNION
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
      )
    )
  );

-- RLS Policies for subscriptions
CREATE POLICY "Workspace owners can view subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can manage subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace_id ON social_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_generated_posts_workspace_id ON generated_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_moderation_status ON generated_posts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workspace_id ON scheduled_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_post_analytics_scheduled_post_id ON post_analytics(scheduled_post_id);

--create the tale for the payment-history or transaction-history 
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,  
  merchant_transaction_id text UNIQUE NOT NULL,             
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'PENDING',
  payment_method text,          
  phonepe_reference_id text,
  recheck_count integer DEFAULT 0,        
  last_checked_at timestamptz DEFAULT now();
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans{
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  plans_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  "limit" JSONB DEFAULT '{}' 

}

CREATE TABLE IF NOT EXISTS users_plans (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    subs_plan_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subs_plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users_plans_history (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    users_plan_id INT NOT NULL,
    plan_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    FOREIGN KEY (users_plan_id) REFERENCES users_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);
